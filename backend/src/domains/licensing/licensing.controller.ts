import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LicensingService } from './licensing.service';

@ApiTags('licensing')
@Controller('api/v1/licensing')
export class LicensingController {
  constructor(private readonly licensing: LicensingService) {}

  @Public()
  @Get('products')
  listProducts(@Query('userId') userId?: string) {
    return this.licensing.listProducts(userId);
  }

  @Get('products/entitled')
  @ApiBearerAuth()
  async entitledProducts(@Query('userId') userId: string) {
    const all = await this.licensing.listProducts(userId);
    return all.filter((p) => p.entitled);
  }
}
