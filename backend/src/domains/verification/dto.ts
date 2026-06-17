import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ enum: ['email', 'sms'] })
  @IsIn(['email', 'sms'])
  channel!: 'email' | 'sms';

  @ApiProperty()
  @IsString()
  target!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ enum: ['email', 'sms'] })
  @IsIn(['email', 'sms'])
  channel!: 'email' | 'sms';

  @ApiProperty()
  @IsString()
  target!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}
