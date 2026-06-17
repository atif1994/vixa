import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../platform/prisma.service';
import { AuditService } from '../../platform/audit.service';
import { AclService } from '../../acl/acl.service';
import { CreateOrgDto, CreateSiteDto } from './dto';

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  return `${base}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acl: AclService,
  ) {}

  async createOrganisation(dto: CreateOrgDto, idempotencyKey?: string) {
    const org = await this.prisma.organisation.create({
      data: {
        name: dto.name,
        slug: slugify(dto.name),
        ownerUserId: dto.ownerUserId,
        country: dto.country,
        city: dto.city,
        address: dto.address,
        postcode: dto.postcode,
        telephone: dto.telephone,
        directors: dto.directors ?? undefined,
      },
    });

    const ostId = await this.acl.syncOrganisation({
      idempotencyKey: idempotencyKey ?? `organisation:${org.id}`,
      entityType: 'organisation',
      localId: org.id,
      payload: dto as unknown as Record<string, unknown>,
      name: org.name,
      profile: {
        country: dto.country,
        city: dto.city,
        address: dto.address,
        postcode: dto.postcode,
        telephone: dto.telephone,
        directors: dto.directors,
      },
    });

    await this.prisma.organisation.update({
      where: { id: org.id },
      data: { ostInfinityOrgId: ostId },
    });

    await this.audit.log({
      eventType: 'ORG_CREATED',
      actorId: dto.ownerUserId,
      resourceType: 'organisation',
      resourceId: org.id,
    });

    return org;
  }

  async createSite(orgId: string, dto: CreateSiteDto, idempotencyKey?: string) {
    const org = await this.prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation not found');

    const site = await this.prisma.site.create({
      data: {
        organisationId: orgId,
        name: dto.name,
        slug: slugify(dto.name),
        location: dto.location,
        managers: dto.managers ?? undefined,
      },
    });

    const ostId = await this.acl.syncSite({
      idempotencyKey: idempotencyKey ?? `site:${site.id}`,
      entityType: 'site',
      localId: site.id,
      payload: dto as unknown as Record<string, unknown>,
      localOrgId: orgId,
      name: site.name,
      profile: { location: dto.location, managers: dto.managers },
    });

    await this.prisma.site.update({
      where: { id: site.id },
      data: { ostInfinitySiteId: ostId },
    });

    await this.audit.log({
      eventType: 'SITE_CREATED',
      resourceType: 'site',
      resourceId: site.id,
      metadata: { orgId },
    });

    return site;
  }

  async deleteOrganisation(orgId: string) {
    await this.prisma.organisation.update({
      where: { id: orgId },
      data: { status: 'deleted' },
    });
  }

  async deleteSite(siteId: string) {
    await this.prisma.site.update({
      where: { id: siteId },
      data: { status: 'deleted' },
    });
  }
}
