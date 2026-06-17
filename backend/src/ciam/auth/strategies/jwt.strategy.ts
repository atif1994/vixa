import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../platform/prisma.service';
import { LicensingService } from '../../../domains/licensing/licensing.service';

export interface JwtPayload {
  sub: string;
  email: string;
  digitalIdentityId: string;
  entitlements: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly licensingService: LicensingService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status === 'closed' || user.status === 'suspended') {
      throw new UnauthorizedException('Account is not active');
    }

    const entitlements = await this.licensingService.getUserEntitlements(user.id);

    return {
      sub: user.id,
      email: user.email,
      digitalIdentityId: user.digitalIdentityId,
      entitlements,
    };
  }
}
