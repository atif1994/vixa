import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OrchestratorService } from './orchestrator.service';
import { StartOnboardingDto } from './dto';

@ApiTags('onboarding')
@Controller('api/v1/onboarding')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Public()
  @Post('start')
  start(@Body() dto: StartOnboardingDto) {
    return this.orchestrator.start(dto);
  }

  @Public()
  @Get('status/:sagaId')
  status(@Param('sagaId') sagaId: string) {
    return this.orchestrator.getStatus(sagaId);
  }
}
