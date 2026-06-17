import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../platform/redis.service';
import { randomInt } from 'crypto';

const MFA_OTP_TTL = 300;
const MFA_OTP_PREFIX = 'mfa:otp:';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly redis: RedisService) {}

  async generateOtp(userId: string): Promise<string> {
    const code = String(randomInt(100000, 999999));
    await this.redis.set(`${MFA_OTP_PREFIX}${userId}`, code, MFA_OTP_TTL);
    return code;
  }

  async sendEmailOtp(email: string, code: string): Promise<void> {
    // Mock: production would use SES, SendGrid, etc.
    this.logger.log(`[MFA EMAIL MOCK] to=${email} code=${code}`);
  }

  async sendSmsOtp(phone: string, code: string): Promise<void> {
    // Mock: production would use Twilio, SNS, etc.
    this.logger.log(`[MFA SMS MOCK] to=${phone} code=${code}`);
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const stored = await this.redis.get(`${MFA_OTP_PREFIX}${userId}`);
    if (!stored || stored !== code) {
      return false;
    }
    await this.redis.del(`${MFA_OTP_PREFIX}${userId}`);
    return true;
  }

  async initiateMfa(userId: string, email: string, phone?: string | null): Promise<void> {
    const code = await this.generateOtp(userId);
    await this.sendEmailOtp(email, code);
    if (phone) {
      await this.sendSmsOtp(phone, code);
    }
  }

  async createChallenge(userId: string, email: string): Promise<{ sessionId: string }> {
    const code = await this.generateOtp(userId);
    await this.sendEmailOtp(email, code);
    const sessionId = `mfa-${userId}-${Date.now()}`;
    await this.redis.set(`mfa:session:${sessionId}`, JSON.stringify({ userId, code }), MFA_OTP_TTL);
    return { sessionId };
  }

  async verifyChallenge(sessionId: string, code: string): Promise<string> {
    const raw = await this.redis.get(`mfa:session:${sessionId}`);
    if (!raw) throw new Error('MFA session expired');
    const { userId, code: expected } = JSON.parse(raw);
    if (expected !== code) throw new Error('Invalid MFA code');
    await this.redis.del(`mfa:session:${sessionId}`);
    return userId;
  }
}
