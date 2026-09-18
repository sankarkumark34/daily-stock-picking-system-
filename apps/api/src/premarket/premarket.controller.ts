import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PreMarketWatchlistDto } from '@nse/shared';
import { PreMarketService } from './premarket.service.js';

@ApiTags('premarket')
@Controller('premarket')
export class PreMarketController {
  constructor(private readonly premarketService: PreMarketService) {}

  @Get('watchlist')
  @ApiOperation({
    summary: 'Generate curated watchlist for the next trading day 9:15-9:30 AM market open window',
  })
  async getWatchlist(@Query('date') date?: string): Promise<PreMarketWatchlistDto> {
    return this.premarketService.getWatchlist(date);
  }
}
