import { SetMetadata } from '@nestjs/common';

export const ENTITLEMENTS_KEY = 'entitlements';
export const RequireEntitlements = (...entitlements: string[]) =>
  SetMetadata(ENTITLEMENTS_KEY, entitlements);
