import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma.service';
import { AuditService } from '../../platform/audit.service';
import { AuthService } from '../auth/auth.service';
import { OrgService } from '../../domains/org/org.service';
import { VerificationService } from '../../domains/verification/verification.service';
import { PaymentsService } from '../../domains/payments/payments.service';
import { LicensingService } from '../../domains/licensing/licensing.service';
import { EventBusService } from '../../events/event-bus.service';
import { StartOnboardingDto } from './dto';

const STEPS = [
  'registration',
  'org_creation',
  'site_creation',
  'email_verification',
  'mobile_verification',
  'card_verification',
  'subscription',
  'activation',
  'completed',
] as const;

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly org: OrgService,
    private readonly verification: VerificationService,
    private readonly payments: PaymentsService,
    private readonly licensing: LicensingService,
    private readonly events: EventBusService,
  ) {}

  async start(dto: StartOnboardingDto) {
    const saga = await this.prisma.saga.create({
      data: {
        currentStep: 'registration',
        payload: dto as unknown as object,
      },
    });

    await this.audit.log({
      eventType: 'ONBOARDING_STARTED',
      resourceType: 'saga',
      resourceId: saga.id,
      correlationId: saga.correlationId,
    });

    try {
      return await this.executeSaga(saga.id, dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.compensate(saga.id, message);
      await this.prisma.saga.update({
        where: { id: saga.id },
        data: { status: 'failed', errorMessage: message },
      });
      return this.getStatus(saga.id);
    }
  }

  async getStatus(sagaId: string) {
    const saga = await this.prisma.saga.findUniqueOrThrow({ where: { id: sagaId } });
    return {
      saga_id: saga.id,
      correlation_id: saga.correlationId,
      status: saga.status,
      current_step: saga.currentStep,
      steps_completed: saga.stepsCompleted,
      user_id: saga.userId,
      error_message: saga.errorMessage,
    };
  }

  private async executeSaga(sagaId: string, dto: StartOnboardingDto) {
    const completed: string[] = [];
    const payload: Record<string, string> = {};

    // Step 1a: Registration
    const user = await this.auth.register({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      recaptchaToken: dto.recaptchaToken ?? 'mock_recaptcha_token',
    });
    payload.userId = user.id;
    completed.push('registration');
    await this.updateSaga(sagaId, { userId: user.id, step: 'org_creation', completed, payload });

    // Step 1b: Organisation
    const org = await this.org.createOrganisation({
      name: dto.orgName,
      ownerUserId: user.id,
      country: dto.country,
      city: dto.city,
      address: dto.address,
      postcode: dto.postcode,
      telephone: dto.telephone,
      directors: dto.directors,
    });
    payload.orgId = org.id;
    completed.push('org_creation');

    // Step 1c: Site
    const site = await this.org.createSite(org.id, {
      name: dto.siteName,
      location: dto.siteLocation,
      managers: dto.siteManagers,
    });
    payload.siteId = site.id;
    completed.push('site_creation');
    await this.updateSaga(sagaId, { step: 'email_verification', completed, payload });

    // Step 2a: Email OTP
    const emailOtp = await this.verification.sendOtp({
      channel: 'email',
      target: dto.email,
      userId: user.id,
    });
    await this.verification.verifyOtp({
      channel: 'email',
      target: dto.email,
      code: emailOtp.devCode ?? '000000',
      userId: user.id,
    });
    completed.push('email_verification');

    // Step 2b: Mobile OTP
    if (dto.phone) {
      const smsOtp = await this.verification.sendOtp({
        channel: 'sms',
        target: dto.phone,
        userId: user.id,
      });
      await this.verification.verifyOtp({
        channel: 'sms',
        target: dto.phone,
        code: smsOtp.devCode ?? '000000',
        userId: user.id,
      });
      completed.push('mobile_verification');
    }

    // Step 3: Card verification (€1 hold — refund job deferred for MVP)
    const payment = await this.payments.verifyCard({
      userId: user.id,
      paymentMethodId: dto.paymentMethodId ?? 'pm_card_mock',
    });
    await this.payments.confirmPayment(payment.transactionId);
    payload.transactionId = payment.transactionId;
    completed.push('card_verification');

    // Step 5: Subscribe + event-driven licence (domain verification step 4 skipped — MVP)
    const sub = await this.payments.subscribe({
      userId: user.id,
      productId: dto.productId,
      paymentMethodId: dto.paymentMethodId ?? 'pm_card_mock',
    });
    payload.subscriptionId = sub.subscriptionId;
    payload.productId = dto.productId;
    completed.push('subscription');

    await this.events.publishPaymentConfirmed(
      {
        userId: user.id,
        productId: dto.productId,
        subscriptionId: sub.subscriptionId,
        transactionId: payment.transactionId,
      },
      { correlationId: sagaId, idempotencyKey: `pay-conf:${sub.subscriptionId}` },
    );

    // Step 5b: Activate
    await this.auth.activateAccount(user.id);
    completed.push('activation', 'completed');

    await this.prisma.saga.update({
      where: { id: sagaId },
      data: {
        status: 'completed',
        currentStep: 'completed',
        stepsCompleted: completed,
        payload,
      },
    });

    await this.audit.log({
      eventType: 'ONBOARDING_COMPLETED',
      actorId: user.id,
      resourceType: 'saga',
      resourceId: sagaId,
    });

    return this.getStatus(sagaId);
  }

  private async compensate(sagaId: string, error: string) {
    const saga = await this.prisma.saga.findUniqueOrThrow({ where: { id: sagaId } });
    const payload = (saga.payload ?? {}) as Record<string, string>;
    const completed = [...(saga.stepsCompleted as string[])].reverse();
    const log: object[] = [];

    for (const step of completed) {
      try {
        if (step === 'subscription' && payload.subscriptionId) {
          await this.payments.cancelSubscription(payload.subscriptionId);
          if (payload.userId && payload.productId) {
            await this.licensing.revokeUserLicences(payload.userId, payload.productId);
          }
        } else if (step === 'card_verification' && payload.transactionId) {
          await this.payments.cancelTransaction(payload.transactionId);
        } else if (step === 'site_creation' && payload.siteId) {
          await this.org.deleteSite(payload.siteId);
        } else if (step === 'org_creation' && payload.orgId) {
          await this.org.deleteOrganisation(payload.orgId);
        } else if (step === 'registration' && payload.userId) {
          await this.auth.suspendAccount(payload.userId, `Onboarding compensation: ${error}`);
        }
        log.push({ step, action: 'compensated', error });
      } catch (e) {
        this.logger.warn(`Compensation failed for ${step}: ${e}`);
      }
    }

    await this.prisma.saga.update({
      where: { id: sagaId },
      data: { compensationLog: log },
    });

    await this.audit.log({
      eventType: 'ONBOARDING_FAILED',
      resourceType: 'saga',
      resourceId: sagaId,
      metadata: { error },
    });
  }

  private async updateSaga(
    sagaId: string,
    data: { userId?: string; step: string; completed: string[]; payload: Record<string, string> },
  ) {
    await this.prisma.saga.update({
      where: { id: sagaId },
      data: {
        userId: data.userId,
        currentStep: data.step,
        stepsCompleted: data.completed,
        payload: data.payload,
      },
    });
  }
}
