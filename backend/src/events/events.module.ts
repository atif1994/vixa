import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventBusService } from './event-bus.service';
import { LicenceProcessor } from './processors/licence.processor';
import { EVENTS_QUEUE } from './constants';
import { LicensingModule } from '../domains/licensing/licensing.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379/0'),
        },
      }),
    }),
    BullModule.registerQueue({ name: EVENTS_QUEUE }),
    forwardRef(() => LicensingModule),
  ],
  providers: [EventBusService, LicenceProcessor],
  exports: [EventBusService, BullModule],
})
export class EventsModule {}
