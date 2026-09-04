import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LiveMarketDto, LiveQuoteDto } from '@nse/shared';
import { LiveQuotesService } from './live-quotes.service.js';

@ApiTags('live')
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveQuotesService) {}

  @Get('quotes')
  @ApiOperation({ summary: 'Delayed live quotes for up to 40 NSE symbols (comma separated)' })
  quotes(@Query('symbols') symbols = ''): Promise<LiveQuoteDto[]> {
    return this.live.quotes(symbols.split(',').filter(Boolean));
  }

  @Get('market')
  @ApiOperation({ summary: 'Delayed live NIFTY 50 and India VIX' })
  market(): Promise<LiveMarketDto> {
    return this.live.market();
  }
}
