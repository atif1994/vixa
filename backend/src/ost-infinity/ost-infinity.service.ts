import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/prisma.service';

/**
 * Mock System-of-Record for Ost Infinity.
 * Production would call the real Ost Infinity REST API.
 */
@Injectable()
export class OstInfinityService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(data: {
    localUserId: string;
    email: string;
    digitalIdentityId: string;
    status?: string;
  }) {
    return this.prisma.ostCustomer.create({
      data: {
        localUserId: data.localUserId,
        email: data.email,
        digitalIdentityId: data.digitalIdentityId,
        status: data.status ?? 'active',
      },
    });
  }

  async updateCustomerStatus(localUserId: string, status: string) {
    return this.prisma.ostCustomer.update({
      where: { localUserId },
      data: { status },
    });
  }

  async getCustomer(localUserId: string) {
    return this.prisma.ostCustomer.findUnique({ where: { localUserId } });
  }

  async createOrganisation(data: {
    localOrgId: string;
    name: string;
    profile?: Record<string, unknown>;
  }) {
    return this.prisma.ostOrganisation.create({
      data: {
        localOrgId: data.localOrgId,
        name: data.name,
        profile: (data.profile ?? undefined) as object | undefined,
      },
    });
  }

  async createSite(data: {
    localSiteId: string;
    localOrgId: string;
    name: string;
    profile?: Record<string, unknown>;
  }) {
    return this.prisma.ostSite.create({
      data: {
        localSiteId: data.localSiteId,
        localOrgId: data.localOrgId,
        name: data.name,
        profile: (data.profile ?? undefined) as object | undefined,
      },
    });
  }

  async createLicence(data: {
    localLicenceId: string;
    localUserId: string;
    productSlug: string;
    status?: string;
  }) {
    return this.prisma.ostLicence.create({
      data: {
        localLicenceId: data.localLicenceId,
        localUserId: data.localUserId,
        productSlug: data.productSlug,
        status: data.status ?? 'active',
      },
    });
  }
}
