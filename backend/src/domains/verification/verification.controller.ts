import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { VerificationService } from './verification.service';
import { SendOtpDto, VerifyOtpDto } from './dto';

@ApiTags('verification')
@Controller('api/v1/verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Public()
  @Post('otp/send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.verification.sendOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.verification.verifyOtp(dto);
  }
}
