import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor';
import { CdnWafMiddleware } from './edge/cdn-waf.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Edge layer stub: CDN/WAF would terminate TLS and filter OWASP attacks in production
  app.use(new CdnWafMiddleware().use.bind(new CdnWafMiddleware()));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new CorrelationInterceptor());

  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('ViXa Platform CIAM API')
    .setDescription('Customer Identity & Access Management — Ost Infinity ecosystem')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`ViXa CIAM API listening on :${port}`);
  console.log(`OpenAPI docs: http://localhost:${port}/api/docs`);
}

bootstrap();
