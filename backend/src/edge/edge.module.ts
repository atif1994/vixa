import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CdnWafMiddleware } from './cdn-waf.middleware';
import { RecaptchaService } from './recaptcha.service';

@Module({
  providers: [RecaptchaService, CdnWafMiddleware],
  exports: [RecaptchaService],
})
export class EdgeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CdnWafMiddleware).forRoutes('*');
  }
}
