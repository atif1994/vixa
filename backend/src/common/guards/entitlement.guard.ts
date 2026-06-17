import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENTS_KEY } from '../decorators/entitlements.decorator';

export interface JwtPayloadUser {
  sub: string;
  email: string;
  entitlements?: string[];
}

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ENTITLEMENTS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayloadUser }>();
    const userEntitlements = request.user?.entitlements ?? [];

    const missing = required.filter((e) => !userEntitlements.includes(e));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required entitlements: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
