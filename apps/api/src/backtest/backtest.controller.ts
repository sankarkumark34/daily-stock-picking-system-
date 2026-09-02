import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BacktestParams, BacktestRunDto, BacktestRunSummaryDto } from '@nse/shared';
import { BacktestService } from './backtest.service.js';

@ApiTags('backtest')
@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtest: BacktestService) {}

  @Get('runs')
  @ApiOperation({ summary: 'List backtest runs' })
  list(): Promise<BacktestRunSummaryDto[]> {
    return this.backtest.list();
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Full result of one backtest run' })
  get(@Param('id', ParseIntPipe) id: number): Promise<BacktestRunDto> {
    return this.backtest.get(id);
  }

  @Post('runs')
  @ApiOperation({ summary: 'Start a backtest (runs in the background)' })
  async start(@Body() body: Partial<BacktestParams>) {
    try {
      const run = await this.backtest.start(body ?? {});
      return { id: run.id, status: run.status };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Delete('runs/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.backtest.remove(id);
    return { deleted: id };
  }

  @Get('defaults')
  defaults(): BacktestParams {
    return this.backtest.normalise({});
  }
}
