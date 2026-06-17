export const EVENTS_QUEUE = 'vixa-events';

export enum EventTopic {
  LICENCE_REQUESTED = 'LICENCE_REQUESTED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
}

export interface DomainEvent<T = Record<string, unknown>> {
  topic: EventTopic;
  payload: T;
  correlationId?: string;
  idempotencyKey?: string;
  publishedAt: string;
}

export interface LicenceRequestedPayload {
  userId: string;
  productId: string;
  organisationId?: string;
  subscriptionId?: string;
}

export interface PaymentConfirmedPayload {
  userId: string;
  productId: string;
  subscriptionId: string;
  transactionId: string;
  organisationId?: string;
}
