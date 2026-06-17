import { Module, forwardRef } from '@nestjs/common';
import { LicensingController } from './licensing.controller';
import { LicensingService } from './licensing.service';
import { AclModule } from '../../acl/acl.module';
import { PlatformModule } from '../../platform/platform.module';

@Module({
  imports: [PlatformModule, forwardRef(() => AclModule)],
  controllers: [LicensingController],
  providers: [LicensingService],
  exports: [LicensingService],
})
export class LicensingModule {}
