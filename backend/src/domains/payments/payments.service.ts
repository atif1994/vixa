import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../platform/prisma.service';
import { AuditService } from '../../platform/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { VerifyCardDto, SubscribeDto } from './dto';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly mockMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get('STRIPE_SECRET_KEY', 'sk_test_mock');
    this.mockMode = key.startsWith('sk_test_mock');
    if (!this.mockMode) {
      this.stripe = new Stripe(key);
    }
  }

  private async getOrCreateCustomer(userId: string) {
    let customer = await this.prisma.paymentCustomer.findUnique({ where: { userId } });
    if (customer) return customer;

    let stripeCustomerId = `cus_mock_${userId.slice(0, 8)}`;
    if (!this.mockMode && this.stripe) {
      const sc = await this.stripe.customers.create({ metadata: { userId } });
      stripeCustomerId = sc.id;
    }

    customer = await this.prisma.paymentCustomer.create({
      data: { userId, stripeCustomerId },
    });
    return customer;
  }

  async verifyCard(dto: VerifyCardDto) {
    const customer = await this.getOrCreateCustomer(dto.userId);
    const amount = Number(this.config.get('STRIPE_HOLD_AMOUNT_CENTS', '100'));

    let intentId = `pi_mock_${Date.now()}`;
    if (!this.mockMode && this.stripe) {
      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'eur',
        customer: customer.stripeCustomerId!,
        payment_method: dto.paymentMethodId,
        capture_method: 'manual',
        confirm: true,
      });
      intentId = intent.id;
    }

    const txn = await this.prisma.transaction.create({
      data: {
        customerId: customer.id,
        stripePaymentIntentId: intentId,
        amountCents: amount,
        status: 'requires_confirmation',
        type: 'card_verification',
      },
    });

    await this.audit.log({
      eventType: 'PAYMENT_INITIATED',
      actorId: dto.userId,
      resourceType: 'transaction',
      resourceId: txn.id,
      metadata: { amountCents: amount },
    });

    return { transactionId: txn.id, status: txn.status };
  }

  async confirmPayment(transactionId: string) {
    const txn = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!txn) throw new NotFoundException('Transaction not found');

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'succeeded' },
    });

    const customer = await this.prisma.paymentCustomer.findUniqueOrThrow({
      where: { id: txn.customerId },
    });

    await this.audit.log({
      eventType: 'PAYMENT_CONFIRMED',
      actorId: customer.userId,
      resourceType: 'transaction',
      resourceId: transactionId,
    });

    return { transactionId, status: 'succeeded' };
  }

  async cancelTransaction(transactionId: string) {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'cancelled' },
    });
    return { transactionId, status: 'cancelled' };
  }

  async subscribe(dto: SubscribeDto) {
    const customer = await this.getOrCreateCustomer(dto.userId);
    const subId = `sub_mock_${Date.now()}`;

    const subscription = await this.prisma.subscription.create({
      data: {
        customerId: customer.id,
        productId: dto.productId,
        stripeSubscriptionId: subId,
        status: 'active',
      },
    });

    await this.events.publishLicenceRequested(
      {
        userId: dto.userId,
        productId: dto.productId,
        subscriptionId: subscription.id,
      },
      { idempotencyKey: `licence-req:${subscription.id}` },
    );

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      productId: dto.productId,
    };
  }

  async cancelSubscription(subscriptionId: string) {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled' },
    });
    return { subscriptionId, status: 'cancelled' };
  }

  async handleWebhook(_payload: Buffer, _sig: string) {
    if (this.mockMode) return { received: true, mode: 'mock' };
    // Production: verify Stripe signature and publish PAYMENT_CONFIRMED
    return { received: true };
  }

  /**
   * €1 hold refund after 3 days — DEFERRED for MVP (would be a scheduled worker job).
   */
  async scheduleHoldRefundStub(_transactionId: string) {
    return { deferred: true, message: '3-day hold refund job deferred for MVP' };
  }
}
