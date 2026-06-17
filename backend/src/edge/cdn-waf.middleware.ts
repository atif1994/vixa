import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * CDN/WAF middleware stub — production would integrate with
 * Cloudflare, AWS CloudFront + WAF, or Akamai edge rules.
 */
@Injectable()
export class CdnWafMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Stub: attach synthetic edge headers for observability
    req.headers['x-edge-request-id'] =
      req.headers['x-edge-request-id'] ?? `edge-${Date.now()}`;
    res.setHeader('X-Edge-Processed', 'true');
    next();
  }
}
