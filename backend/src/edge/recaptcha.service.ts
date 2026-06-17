import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Mock reCAPTCHA verification — production would call Google siteverify API.
   */
  async verify(token: string): Promise<number> {
    const secret = this.config.get<string>('RECAPTCHA_SECRET_KEY', 'mock');
    this.logger.debug(`reCAPTCHA verify (mock) token=${token.slice(0, 8)}... secret=${secret.slice(0, 4)}...`);

    if (token === 'fail' || token === 'bot') {
      return 0.1;
    }
    return 0.9;
  }
}
