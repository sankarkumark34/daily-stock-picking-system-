import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SwingRadarSummaryDto } from '@nse/shared';
import { SwingService } from './swing.service.js';

@ApiTags('swing')
@Controller('swing')
export class SwingController {
  constructor(private readonly swingService: SwingService) {}

  @Get('radar')
  @ApiOperation({
    summary: '10-Day Swing Trading Radar (NSE Cash & Delivery)',
    description:
      'Scans liquid NSE universe for high-confluence 10-day swing setups (EMA Pullbacks, Volume Breakouts, VCP, etc.) with position sizing & feasibility checks.',
  })
  async getRadar(
    @Query('date') date?: string,
    @Query('strategy') strategy?: string,
    @Query('minRR') minRR?: string,
    @Query('sector') sector?: string,
    @Query('capital') capital?: string,
    @Query('riskPct') riskPct?: string,
    @Query('search') search?: string,
  ): Promise<SwingRadarSummaryDto> {
    return this.swingService.getSwingRadar({
      date,
      strategy,
      minRR: minRR ? Number(minRR) : undefined,
      sector,
      capital: capital ? Number(capital) : undefined,
      riskPct: riskPct ? Number(riskPct) : undefined,
      search,
    });
  }
}
