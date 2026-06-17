import { Module } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { PlatformModule } from '../../platform/platform.module';

@Module({
  imports: [PlatformModule],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
