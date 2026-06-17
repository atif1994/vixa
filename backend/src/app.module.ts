import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PlatformModule } from './platform/platform.module';
import { EdgeModule } from './edge/edge.module';
import { EventsModule } from './events/events.module';
import { AclModule } from './acl/acl.module';
import { OstInfinityModule } from './ost-infinity/ost-infinity.module';
import { AuthModule } from './ciam/auth/auth.module';
import { MfaModule } from './ciam/mfa/mfa.module';
import { OrchestratorModule } from './ciam/orchestrator/orchestrator.module';
import { OrgModule } from './domains/org/org.module';
import { VerificationModule } from './domains/verification/verification.module';
import { PaymentsModule } from './domains/payments/payments.module';
import { LicensingModule } from './domains/licensing/licensing.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

/**
 * ViXa CIAM monolith — structured as NestJS modules per architecture layer.
 * Each module can be extracted to a microservice via @nestjs/microservices later.
 *
 * Layers represented:
 * - Edge (CDN/WAF stub, reCAPTCHA) — EdgeModule
 * - Gateway (JWT, rate limit, throttling) — global guards + this app entry
 * - CIAM Core — AuthModule, MfaModule, OrchestratorModule
 * - Domain Services — Org, Verification, Payments, Licensing modules
 * - Event Backbone — EventsModule (BullMQ; prod: Kafka/RabbitMQ)
 * - ACL — AclModule (only path to Ost Infinity)
 * - Ost Infinity — OstInfinityModule (mock SoR for MVP)
 * - Platform — PlatformModule (Prisma/Postgres, Redis, Vault, Audit)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 20,
      },
    ]),
    PlatformModule,
    EdgeModule,
    EventsModule,
    OstInfinityModule,
    AclModule,
    AuthModule,
    MfaModule,
    OrchestratorModule,
    OrgModule,
    VerificationModule,
    PaymentsModule,
    LicensingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // CDN/WAF applied in main.ts bootstrap
  }
}
