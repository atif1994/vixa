import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LicensingService } from '../../domains/licensing/licensing.service';
import { EventBusService } from '../event-bus.service';
import {
  DomainEvent,
  EVENTS_QUEUE,
  EventTopic,
  PaymentConfirmedPayload,
} from '../constants';

@Processor(EVENTS_QUEUE)
export class LicenceProcessor extends WorkerHost {
  private readonly logger = new Logger(LicenceProcessor.name);

  constructor(
    private readonly licensingService: LicensingService,
    private readonly eventBus: EventBusService,
  ) {
    super();
  }

  async process(job: Job<DomainEvent>): Promise<void> {
    const { topic, payload } = job.data;

    switch (topic) {
      case EventTopic.PAYMENT_CONFIRMED:
        await this.handlePaymentConfirmed(payload as unknown as PaymentConfirmedPayload);
        break;
      case EventTopic.LICENCE_REQUESTED:
        this.logger.log(`LICENCE_REQUESTED received for user ${(payload as { userId: string }).userId}`);
        break;
      default:
        this.logger.warn(`Unknown event topic: ${topic}`);
    }
  }

  private async handlePaymentConfirmed(payload: PaymentConfirmedPayload): Promise<void> {
    this.logger.log(
      `Assigning licence for user=${payload.userId} product=${payload.productId}`,
    );
    await this.licensingService.assignLicence({
      userId: payload.userId,
      productId: payload.productId,
      organisationId: payload.organisationId,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DomainEvent>, error: Error): Promise<void> {
    await this.eventBus.moveToDeadLetter(
      job.data.topic,
      job.data,
      error.message,
      job.attemptsMade,
    );
  }
}
