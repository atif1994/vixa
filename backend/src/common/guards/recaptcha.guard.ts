import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RecaptchaService } from '../../edge/recaptcha.service';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: { recaptchaToken?: string };
    }>();

    const token =
      request.body?.recaptchaToken ||
      (request.headers['x-recaptcha-token'] as string | undefined);

    if (!token) {
      throw new ForbiddenException('reCAPTCHA token is required');
    }

    const score = await this.recaptchaService.verify(token);
    if (score < 0.5) {
      throw new ForbiddenException('reCAPTCHA verification failed');
    }

    return true;
  }
}
