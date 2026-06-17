import { Controller, Post, Body, Param, Req, Headers, RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { VerifyCardDto, SubscribeDto } from './dto';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('verify-card')
  verifyCard(@Body() dto: VerifyCardDto) {
    return this.payments.verifyCard(dto);
  }

  @Public()
  @Post('confirm/:transactionId')
  confirm(@Param('transactionId') transactionId: string) {
    return this.payments.confirmPayment(transactionId);
  }

  @Public()
  @Post('transactions/:transactionId/cancel')
  cancelTxn(@Param('transactionId') transactionId: string) {
    return this.payments.cancelTransaction(transactionId);
  }

  @Public()
  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.payments.subscribe(dto);
  }

  @Public()
  @Post('subscriptions/:subscriptionId/cancel')
  cancelSub(@Param('subscriptionId') subscriptionId: string) {
    return this.payments.cancelSubscription(subscriptionId);
  }

  @Public()
  @Post('webhooks/stripe')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig: string) {
    return this.payments.handleWebhook(req.rawBody ?? Buffer.from(''), sig ?? '');
  }
}
