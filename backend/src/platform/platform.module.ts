import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { VaultService } from './vault.service';
import { AuditService } from './audit.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [PrismaService, RedisService, VaultService, AuditService],
  exports: [PrismaService, RedisService, VaultService, AuditService],
})
export class PlatformModule {}
