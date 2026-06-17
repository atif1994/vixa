import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  MfaVerifyDto,
  AccountActionDto,
} from './dto';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, req.ip);
  }

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip);
  }

  @Public()
  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.verifyMfa(dto, req.ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto, req.ip);
  }

  @Get('users/:userId')
  @ApiBearerAuth()
  getUser(@Param('userId') userId: string) {
    return this.auth.getUser(userId);
  }

  @Post('users/:userId/activate')
  @Public()
  activate(@Param('userId') userId: string) {
    return this.auth.activateAccount(userId);
  }

  @Post('users/:userId/suspend')
  @ApiBearerAuth()
  suspend(@Param('userId') userId: string, @Body() dto: AccountActionDto) {
    return this.auth.suspendAccount(userId, dto.reason);
  }

  @Post('users/:userId/close')
  @ApiBearerAuth()
  close(@Param('userId') userId: string, @Body() dto: AccountActionDto) {
    return this.auth.closeAccount(userId, dto.reason);
  }

  @Post('users/:userId/mfa/enable')
  @ApiBearerAuth()
  enableMfa(@Param('userId') userId: string) {
    return this.auth.enableMfa(userId);
  }
}
