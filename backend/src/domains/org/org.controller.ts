import { Controller, Post, Delete, Body, Param, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OrgService } from './org.service';
import { CreateOrgDto, CreateSiteDto } from './dto';

@ApiTags('organisations')
@Controller('api/v1/orgs')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Public()
  @Post()
  @ApiHeader({ name: 'X-Idempotency-Key', required: false })
  createOrg(@Body() dto: CreateOrgDto, @Headers('x-idempotency-key') key?: string) {
    return this.org.createOrganisation(dto, key);
  }

  @Public()
  @Post(':orgId/sites')
  @ApiHeader({ name: 'X-Idempotency-Key', required: false })
  createSite(
    @Param('orgId') orgId: string,
    @Body() dto: CreateSiteDto,
    @Headers('x-idempotency-key') key?: string,
  ) {
    return this.org.createSite(orgId, dto, key);
  }

  @Delete(':orgId')
  @ApiBearerAuth()
  deleteOrg(@Param('orgId') orgId: string) {
    return this.org.deleteOrganisation(orgId);
  }

  @Delete('sites/:siteId')
  @ApiBearerAuth()
  deleteSite(@Param('siteId') siteId: string) {
    return this.org.deleteSite(siteId);
  }
}
