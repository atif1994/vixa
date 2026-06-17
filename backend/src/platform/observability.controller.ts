import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../platform/prisma.service';

@ApiTags('observability')
@Controller('api/v1/observability')
export class ObservabilityController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'healthy',
      service: 'vixa-ciam',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('audit/recent')
  async recentAudit() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventType: true,
        actorId: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    });
    return { count: logs.length, logs: logs.map((l) => ({
      id: l.id,
      event_type: l.eventType,
      actor_id: l.actorId,
      resource_type: l.resourceType,
      resource_id: l.resourceId,
      created_at: l.createdAt,
    })) };
  }
}
