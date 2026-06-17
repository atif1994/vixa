import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../platform/prisma.service';
import { AuditService } from '../../platform/audit.service';
import { RedisService } from '../../platform/redis.service';
import { AclService } from '../../acl/acl.service';
import { RecaptchaService } from '../../edge/recaptcha.service';
import { MfaService } from '../mfa/mfa.service';
import { LicensingService } from '../../domains/licensing/licensing.service';
import { RegisterDto, LoginDto, RefreshTokenDto, MfaVerifyDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly acl: AclService,
    private readonly recaptcha: RecaptchaService,
    private readonly mfa: MfaService,
    private readonly licensing: LicensingService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const score = await this.recaptcha.verify(dto.recaptchaToken ?? 'mock_recaptcha_token');
    if (score < 0.5) throw new BadRequestException('reCAPTCHA verification failed');

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'pending_verification',
      },
    });

    await this.acl.syncCustomer({
      idempotencyKey: `customer:${user.id}`,
      entityType: 'customer',
      localId: user.id,
      payload: { email: user.email },
      email: user.email,
      digitalIdentityId: user.digitalIdentityId,
    });

    await this.audit.log({
      eventType: 'USER_REGISTERED',
      actorId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ip,
      metadata: { email: user.email },
    });

    return this.toUserResponse(user);
  }

  async login(dto: LoginDto, ip?: string) {
    const score = await this.recaptcha.verify(dto.recaptchaToken ?? 'mock_recaptcha_token');
    if (score < 0.5) throw new BadRequestException('reCAPTCHA verification failed');

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.log({ eventType: 'USER_LOGIN_FAILED', ipAddress: ip, metadata: { email: dto.email } });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'suspended') throw new UnauthorizedException('Account suspended');
    if (user.status === 'closed') throw new UnauthorizedException('Account closed');

    if (user.mfaEnabled) {
      const session = await this.mfa.createChallenge(user.id, user.email);
      await this.audit.log({ eventType: 'MFA_CHALLENGE', actorId: user.id, ipAddress: ip });
      return { mfa_required: true, mfa_session_id: session.sessionId };
    }

    return this.issueTokens(user, ip);
  }

  async verifyMfa(dto: MfaVerifyDto, ip?: string) {
    let userId: string;
    try {
      userId = await this.mfa.verifyChallenge(dto.mfa_session_id, dto.code);
    } catch {
      throw new UnauthorizedException('Invalid MFA code');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.audit.log({ eventType: 'MFA_VERIFIED', actorId: user.id, ipAddress: ip });
    return this.issueTokens(user, ip);
  }

  async refresh(dto: RefreshTokenDto, ip?: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(dto.refreshToken, {
        secret: this.config.get('JWT_SECRET', 'dev-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const hash = createHash('sha256').update(dto.refreshToken).digest('hex');
    const stored = await this.redis.get(`refresh:${hash}`);
    if (!stored) throw new UnauthorizedException('Refresh token revoked or expired');

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revoked: false },
      data: { revoked: true },
    });
    await this.redis.del(`refresh:${hash}`);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    await this.audit.log({ eventType: 'TOKEN_REFRESH', actorId: user.id, ipAddress: ip });
    return this.issueTokens(user, ip);
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    return this.toUserResponse(user);
  }

  async activateAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
    });
    return this.getUser(userId);
  }

  async suspendAccount(userId: string, reason?: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended' } });
    await this.acl.updateCustomerStatus(`suspend:${userId}`, userId, 'suspended');
    await this.audit.log({ eventType: 'ACCOUNT_SUSPENDED', actorId: userId, metadata: { reason } });
    return this.getUser(userId);
  }

  async closeAccount(userId: string, reason?: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'closed' } });
    await this.acl.updateCustomerStatus(`close:${userId}`, userId, 'closed');
    await this.audit.log({ eventType: 'ACCOUNT_CLOSED', actorId: userId, metadata: { reason } });
    return this.getUser(userId);
  }

  async enableMfa(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return this.getUser(userId);
  }

  private async issueTokens(user: { id: string; email: string; digitalIdentityId: string }, ip?: string) {
    const entitlements = await this.licensing.getUserEntitlements(user.id);
    const accessExpires = this.config.get('JWT_ACCESS_EXPIRE_MINUTES', '15');
    const refreshDays = this.config.get('JWT_REFRESH_EXPIRE_DAYS', '7');

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        digitalIdentityId: user.digitalIdentityId,
        entitlements,
        type: 'access',
      },
      { expiresIn: `${accessExpires}m` },
    );

    const refreshRaw = randomBytes(32).toString('hex');
    const refreshToken = this.jwt.sign(
      { sub: user.id, type: 'refresh', jti: refreshRaw },
      { expiresIn: `${refreshDays}d` },
    );
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + Number(refreshDays) * 86400000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    await this.redis.set(`refresh:${hash}`, user.id, Number(refreshDays) * 86400);

    await this.audit.log({ eventType: 'USER_LOGIN', actorId: user.id, ipAddress: ip });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: Number(accessExpires) * 60,
      mfa_required: false,
      mfa_session_id: null,
      entitlements,
    };
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    digitalIdentityId: string;
    status: string;
    mfaEnabled: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      digital_identity_id: user.digitalIdentityId,
      status: user.status,
      mfa_enabled: user.mfaEnabled,
      email_verified: user.emailVerified,
      phone_verified: user.phoneVerified,
    };
  }
}
