import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { PlatformModule } from '../../platform/platform.module';
import { MfaModule } from '../../ciam/mfa/mfa.module';

@Module({
  imports: [PlatformModule, MfaModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
