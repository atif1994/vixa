import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { PlatformModule } from '../../platform/platform.module';
import { AclModule } from '../../acl/acl.module';

@Module({
  imports: [PlatformModule, AclModule],
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}
