import { Module } from '@nestjs/common';
import { OstInfinityService } from './ost-infinity.service';

@Module({
  providers: [OstInfinityService],
  exports: [OstInfinityService],
})
export class OstInfinityModule {}
