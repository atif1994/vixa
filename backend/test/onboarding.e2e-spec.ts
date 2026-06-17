import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/platform/prisma.service';

describe('Onboarding E2E (register → verify → pay → subscribe → entitled)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const sub = await prisma.product.findFirst({ where: { slug: 'vixa-xdr-xsiam', isBase: false } });
    if (!sub) throw new Error('Run prisma seed before e2e tests');
    productId = sub.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes onboarding saga and grants product entitlement', async () => {
    const email = `e2e-${Date.now()}@vixa.test`;

    const sagaRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/start')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'E2E',
        lastName: 'User',
        phone: '+31612345678',
        orgName: 'E2E Org',
        country: 'Netherlands',
        city: 'Amsterdam',
        siteName: 'HQ',
        productId,
        paymentMethodId: 'pm_card_mock',
        recaptchaToken: 'mock_recaptcha_token',
      })
      .expect(201);

    expect(sagaRes.body.status).toBe('completed');
    expect(sagaRes.body.user_id).toBeTruthy();

    const userId = sagaRes.body.user_id;

    await new Promise((r) => setTimeout(r, 1500));

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'SecurePass123!',
        recaptchaToken: 'mock_recaptcha_token',
      })
      .expect(201);

    expect(loginRes.body.access_token).toBeTruthy();
    expect(Array.isArray(loginRes.body.entitlements)).toBe(true);

    const productsRes = await request(app.getHttpServer())
      .get(`/api/v1/licensing/products?userId=${userId}`)
      .expect(200);

    const entitled = productsRes.body.filter((p: { entitled: boolean }) => p.entitled);
    expect(entitled.length).toBeGreaterThanOrEqual(2);
    expect(entitled.some((p: { is_base: boolean }) => p.is_base)).toBe(true);
  });
});
