import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../platform/prisma.service';
import {
  DomainEvent,
  EVENTS_QUEUE,
  EventTopic,
} from './constants';

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectQueue(EVENTS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Publish domain events via BullMQ (MVP).
   * Production would use Kafka or RabbitMQ for durable fan-out.
   */
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    this.logger.log(`Publishing ${event.topic} correlation=${event.correlationId ?? 'n/a'}`);
    await this.queue.add(event.topic, event, {
      jobId: event.idempotencyKey?.replace(/:/g, '-'),
      removeOnComplete: 100,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async publishLicenceRequested(
    payload: DomainEvent['payload'] & { userId: string; productId: string },
    meta?: { correlationId?: string; idempotencyKey?: string },
  ): Promise<void> {
    await this.publish({
      topic: EventTopic.LICENCE_REQUESTED,
      payload,
      correlationId: meta?.correlationId,
      idempotencyKey: meta?.idempotencyKey,
      publishedAt: new Date().toISOString(),
    });
  }

  async publishPaymentConfirmed(
    payload: DomainEvent['payload'] & {
      userId: string;
      productId: string;
      subscriptionId: string;
      transactionId: string;
    },
    meta?: { correlationId?: string; idempotencyKey?: string },
  ): Promise<void> {
    await this.publish({
      topic: EventTopic.PAYMENT_CONFIRMED,
      payload,
      correlationId: meta?.correlationId,
      idempotencyKey: meta?.idempotencyKey,
      publishedAt: new Date().toISOString(),
    });
  }

  async moveToDeadLetter(
    topic: string,
    payload: unknown,
    error: string,
    attempts: number,
  ): Promise<void> {
    this.logger.error(`DLQ: ${topic} — ${error}`);
    await this.prisma.deadLetterEvent.create({
      data: {
        topic,
        payload: payload as object,
        error,
        attempts,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
