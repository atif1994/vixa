import { Injectable, BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../../platform/prisma.service';
import { AuditService } from '../../platform/audit.service';
import { MfaService } from '../../ciam/mfa/mfa.service';
import { SendOtpDto, VerifyOtpDto } from './dto';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpChallenge.create({
      data: {
        channel: dto.channel,
        target: dto.target,
        code,
        userId: dto.userId,
        expiresAt,
      },
    });

    if (dto.channel === 'email') {
      await this.mfa.sendEmailOtp(dto.target, code);
    } else {
      await this.mfa.sendSmsOtp(dto.target, code);
    }

    return {
      message: 'OTP sent',
      devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        channel: dto.channel,
        target: dto.target,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.code !== dto.code) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verified: true },
    });

    if (dto.userId) {
      if (dto.channel === 'email') {
        await this.prisma.user.update({
          where: { id: dto.userId },
          data: { emailVerified: true },
        });
      } else if (dto.channel === 'sms') {
        await this.prisma.user.update({
          where: { id: dto.userId },
          data: { phoneVerified: true },
        });
      }
    }

    await this.audit.log({
      eventType: dto.channel === 'email' ? 'EMAIL_VERIFIED' : 'PHONE_VERIFIED',
      actorId: dto.userId,
      metadata: { target: dto.target },
    });

    return { verified: true };
  }

  /**
   * Domain verification (TXT/CNAME DNS check) — DEFERRED for MVP.
   * See README: out of scope for this sprint.
   */
  async verifyDomainStub(_orgId: string): Promise<{ deferred: true; message: string }> {
    return {
      deferred: true,
      message: 'Domain verification is deferred for MVP. Would generate TXT/CNAME records and poll DNS.',
    };
  }
}
