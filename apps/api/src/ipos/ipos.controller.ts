import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IpoDto } from '@nse/shared';
import { IposService } from './ipos.service.js';

@ApiTags('IPOs')
@Controller('ipos')
export class IposController {
  private readonly log = new Logger(IposController.name);

  constructor(private readonly iposService: IposService) {}

  @Get('upcoming')
  @ApiOperation({ summary: 'List upcoming and current IPOs with Elite Grade analysis' })
  async getUpcomingIpos(): Promise<IpoDto[]> {
    return this.iposService.getUpcomingIpos();
  }
}
