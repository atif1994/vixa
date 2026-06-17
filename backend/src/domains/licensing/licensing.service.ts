import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma.service';
import { AclService } from '../../acl/acl.service';

@Injectable()
export class LicensingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
  ) {}

  async getUserEntitlements(userId: string): Promise<string[]> {
    const products = await this.prisma.product.findMany({ where: { active: true } });
    const licences = await this.prisma.licence.findMany({
      where: { userId, status: 'active' },
      select: { productId: true },
    });
    const licensed = new Set(licences.map((l) => l.productId));
    return products
      .filter((p) => p.isBase || licensed.has(p.id))
      .map((p) => p.slug);
  }

  async listProducts(userId?: string) {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { isBase: 'desc' },
      include: { entitlements: true },
    });
    const licensed = userId
      ? new Set(
          (
            await this.prisma.licence.findMany({
              where: { userId, status: 'active' },
              select: { productId: true },
            })
          ).map((l) => l.productId),
        )
      : new Set<string>();

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price_cents: p.priceCents,
      currency: p.currency,
      is_base: p.isBase,
      entitled: p.isBase || licensed.has(p.id),
    }));
  }

  async assignLicence(input: {
    userId: string;
    productId: string;
    organisationId?: string;
    subscriptionId?: string;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new Error('Product not found');
    if (product.isBase) throw new Error('Base product is included for all customers');

    const licence = await this.prisma.licence.create({
      data: {
        userId: input.userId,
        productId: product.id,
        organisationId: input.organisationId,
        status: 'active',
        ostInfinityLicenceId: `ost-lic-${Date.now()}`,
      },
    });

    await this.acl.syncLicence({
      idempotencyKey: `licence:${licence.id}`,
      entityType: 'licence',
      localId: licence.id,
      payload: input as unknown as Record<string, unknown>,
      localUserId: input.userId,
      productSlug: product.slug,
    });

    return licence;
  }

  async revokeUserLicences(userId: string, productId?: string) {
    return this.prisma.licence.updateMany({
      where: { userId, status: 'active', ...(productId ? { productId } : {}) },
      data: { status: 'revoked' },
    });
  }
}
