import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = [
    {
      name: 'ViXa Platform',
      slug: 'vixa-platform',
      description: 'Base CIAM platform — included for all customers',
      priceCents: 0,
      isBase: true,
      ostInfinityProductId: 'ost-prod-vixa-platform',
    },
    {
      name: 'ViXa XDR-XSIAM',
      slug: 'vixa-xdr-xsiam',
      description: 'Extended detection and response subscription',
      priceCents: 9900,
      isBase: false,
      ostInfinityProductId: 'ost-prod-vixa-xdr-xsiam',
    },
    {
      name: 'ViXa AI',
      slug: 'vixa-ai',
      description: 'AI-powered security analytics subscription',
      priceCents: 7900,
      isBase: false,
      ostInfinityProductId: 'ost-prod-vixa-ai',
    },
    {
      name: 'ViXa AutoArk',
      slug: 'vixa-autoark',
      description: 'Automated compliance and remediation subscription',
      priceCents: 6900,
      isBase: false,
      ostInfinityProductId: 'ost-prod-vixa-autoark',
    },
    {
      name: 'ViXa Vault',
      slug: 'vixa-vault',
      description: 'Secrets and credential vault subscription',
      priceCents: 4900,
      isBase: false,
      ostInfinityProductId: 'ost-prod-vixa-vault',
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: p,
      update: { name: p.name, description: p.description, priceCents: p.priceCents, isBase: p.isBase },
    });
  }

  const base = await prisma.product.findUnique({ where: { slug: 'vixa-platform' } });
  if (base) {
    await prisma.entitlement.upsert({
      where: { productId_featureKey: { productId: base.id, featureKey: 'ciam_core' } },
      create: { productId: base.id, featureKey: 'ciam_core', featureName: 'CIAM Core Access' },
      update: {},
    });
  }

  console.log('Seeded canonical ViXa products');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
