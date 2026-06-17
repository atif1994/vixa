import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma.service';
import { OstInfinityService } from '../ost-infinity/ost-infinity.service';

export type AclEntityType = 'customer' | 'organisation' | 'site' | 'licence';

export interface AclSyncInput {
  idempotencyKey: string;
  entityType: AclEntityType;
  localId: string;
  payload: Record<string, unknown>;
}

/**
 * Anti-Corruption Layer — the only path to Ost Infinity writes.
 * All sync operations are idempotent via AclSyncRecord.
 */
@Injectable()
export class AclService {
  private readonly logger = new Logger(AclService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ostInfinity: OstInfinityService,
  ) {}

  async syncCustomer(input: AclSyncInput & {
    email: string;
    digitalIdentityId: string;
    status?: string;
  }): Promise<string> {
    return this.syncEntity(input, async () => {
      const ost = await this.ostInfinity.createCustomer({
        localUserId: input.localId,
        email: input.email,
        digitalIdentityId: input.digitalIdentityId,
        status: input.status ?? 'active',
      });
      return ost.id;
    });
  }

  async syncOrganisation(input: AclSyncInput & {
    name: string;
    profile?: Record<string, unknown>;
  }): Promise<string> {
    return this.syncEntity(input, async () => {
      const ost = await this.ostInfinity.createOrganisation({
        localOrgId: input.localId,
        name: input.name,
        profile: input.profile,
      });
      return ost.id;
    });
  }

  async syncSite(input: AclSyncInput & {
    localOrgId: string;
    name: string;
    profile?: Record<string, unknown>;
  }): Promise<string> {
    return this.syncEntity(input, async () => {
      const ost = await this.ostInfinity.createSite({
        localSiteId: input.localId,
        localOrgId: input.localOrgId,
        name: input.name,
        profile: input.profile,
      });
      return ost.id;
    });
  }

  async syncLicence(input: AclSyncInput & {
    localUserId: string;
    productSlug: string;
    status?: string;
  }): Promise<string> {
    return this.syncEntity(input, async () => {
      const ost = await this.ostInfinity.createLicence({
        localLicenceId: input.localId,
        localUserId: input.localUserId,
        productSlug: input.productSlug,
        status: input.status ?? 'active',
      });
      return ost.id;
    });
  }

  async updateCustomerStatus(
    idempotencyKey: string,
    localUserId: string,
    status: string,
  ): Promise<void> {
    const key = `${idempotencyKey}:status`;
    const existing = await this.prisma.aclSyncRecord.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      return;
    }

    await this.ostInfinity.updateCustomerStatus(localUserId, status);
    await this.prisma.aclSyncRecord.create({
      data: {
        idempotencyKey: key,
        entityType: 'customer',
        localId: localUserId,
        payload: { status },
      },
    });
  }

  private async syncEntity(
    input: AclSyncInput,
    createFn: () => Promise<string>,
  ): Promise<string> {
    const existing = await this.prisma.aclSyncRecord.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing?.ostInfinityId) {
      this.logger.debug(`ACL idempotent hit: ${input.idempotencyKey}`);
      return existing.ostInfinityId;
    }

    const ostId = await createFn();

    await this.prisma.aclSyncRecord.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        idempotencyKey: input.idempotencyKey,
        entityType: input.entityType,
        localId: input.localId,
        ostInfinityId: ostId,
        payload: input.payload as object,
      },
      update: {
        ostInfinityId: ostId,
        payload: input.payload as object,
      },
    });

    return ostId;
  }
}
