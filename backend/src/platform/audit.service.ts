import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from './prisma.service';

export interface AuditEventInput {
  eventType: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEventInput): Promise<void> {
    const payload = JSON.stringify({
      eventType: event.eventType,
      actorId: event.actorId ?? null,
      resourceType: event.resourceType ?? null,
      resourceId: event.resourceId ?? null,
      correlationId: event.correlationId ?? null,
      ipAddress: event.ipAddress ?? null,
      metadata: event.metadata ?? null,
      timestamp: new Date().toISOString(),
    });

    const checksum = createHash('sha256').update(payload).digest('hex');

    await this.prisma.auditLog.create({
      data: {
        eventType: event.eventType,
        actorId: event.actorId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        metadata: (event.metadata ?? undefined) as object | undefined,
        checksum,
      },
    });
  }
}
