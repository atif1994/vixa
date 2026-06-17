import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCardDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ default: 'pm_card_mock' })
  @IsString()
  paymentMethodId!: string;
}

export class SubscribeDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ default: 'pm_card_mock' })
  @IsString()
  paymentMethodId!: string;
}
