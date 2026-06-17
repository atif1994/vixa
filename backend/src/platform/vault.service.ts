import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vault integration stub — production would use HashiCorp Vault
 * or cloud KMS for secret rotation and dynamic credentials.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(private readonly config: ConfigService) {}

  async getSecret(path: string): Promise<string | null> {
    this.logger.debug(`Vault read (mock): ${path}`);
    const mapping: Record<string, string> = {
      'secret/data/jwt': this.config.get<string>('JWT_SECRET', 'dev-secret'),
      'secret/data/stripe': this.config.get<string>('STRIPE_SECRET_KEY', 'sk_test_mock'),
      'secret/data/recaptcha': this.config.get<string>('RECAPTCHA_SECRET_KEY', 'mock'),
    };
    return mapping[path] ?? null;
  }

  async writeSecret(path: string, _value: Record<string, string>): Promise<void> {
    this.logger.debug(`Vault write (mock): ${path}`);
  }
}
