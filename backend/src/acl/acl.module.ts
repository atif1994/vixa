import { Module } from '@nestjs/common';
import { AclService } from './acl.service';
import { OstInfinityModule } from '../ost-infinity/ost-infinity.module';

@Module({
  imports: [OstInfinityModule],
  providers: [AclService],
  exports: [AclService],
})
export class AclModule {}
