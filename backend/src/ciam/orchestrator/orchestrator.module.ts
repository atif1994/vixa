import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { PlatformModule } from '../../platform/platform.module';
import { AuthModule } from '../auth/auth.module';
import { OrgModule } from '../../domains/org/org.module';
import { VerificationModule } from '../../domains/verification/verification.module';
import { PaymentsModule } from '../../domains/payments/payments.module';
import { LicensingModule } from '../../domains/licensing/licensing.module';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [
    PlatformModule,
    forwardRef(() => AuthModule),
    OrgModule,
    VerificationModule,
    PaymentsModule,
    LicensingModule,
    EventsModule,
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
})
export class OrchestratorModule {}
