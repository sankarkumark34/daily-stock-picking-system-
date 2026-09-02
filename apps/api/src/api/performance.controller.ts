import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { PerformanceSummaryDto, PerformanceWindowDto } from '@nse/shared';
import { IsNull, Repository } from 'typeorm';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { dailySeries, groupStats, shiftDate } from '../quant/metrics.js';
import type { TradeRecord } from '../quant/types.js';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(@InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>) {}

  @Get('summary')
  @ApiOperation({ summary: 'Hit rates and expectancy over rolling windows (live picks by default, or a backtest run)' })
  async summary(@Query('runId') runId?: string): Promise<PerformanceSummaryDto> {
    const where = runId ? { runId: Number(runId) } : { runId: IsNull() };
    const rows = await this.predictions.find({ where, order: { date: 'ASC' } });
    const trades: TradeRecord[] = rows.map((p) => ({
      date: p.date,
      symbol: p.symbol,
      sector: p.sector,
      setup: p.setup,
      regime: p.regime,
      outcome: p.outcome as TradeRecord['outcome'],
      grossReturnPct: p.grossReturnPct,
      netReturnPct: p.netReturnPct,
      outcomeDate: p.outcomeDate,
      daysHeld: p.daysHeld,
    }));
    const asOf = rows.length ? rows[rows.length - 1].date : new Date().toISOString().slice(0, 10);
    const windows: PerformanceWindowDto[] = [
      ['Today', 0],
      ['7 days', 7],
      ['30 days', 30],
      ['90 days', 90],
      ['6 months', 182],
      ['1 year', 365],
      ['All time', 36500],
    ].map(([label, days]) => windowStats(trades, label as string, shiftDate(asOf, -(days as number)), asOf));
    return {
      asOf,
      windows,
      byRegime: groupStats(trades, (t) => t.regime),
      bySetup: groupStats(trades, (t) => t.setup),
      daily: dailySeries(trades),
    };
  }
}

function windowStats(trades: TradeRecord[], label: string, fromDate: string, toDate: string): PerformanceWindowDto {
  const list = trades.filter((t) => t.date >= fromDate && t.date <= toDate);
  const filled = list.filter((t) => t.outcome !== 'NO_FILL');
  const closed = filled.filter((t) => t.outcome !== 'OPEN');
  const success = closed.filter((t) => t.outcome === 'SUCCESS').length;
  const failure = closed.filter((t) => t.outcome === 'FAILURE').length;
  const expired = closed.filter((t) => t.outcome === 'EXPIRED').length;
  const rets = closed.map((t) => t.netReturnPct ?? 0);
  const wins = rets.filter((r) => r > 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(rets.filter((r) => r <= 0).reduce((a, b) => a + b, 0));
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    label,
    fromDate,
    toDate,
    picks: list.length,
    filled: filled.length,
    success,
    failure,
    expired,
    open: filled.length - closed.length,
    hitRate: closed.length ? r3((success / closed.length) * 100) : null,
    directionalAccuracy: closed.length ? r3((wins.length / closed.length) * 100) : null,
    avgNetReturnPct: closed.length ? r3(rets.reduce((a, b) => a + b, 0) / closed.length) : null,
    expectancyPct: closed.length ? r3(rets.reduce((a, b) => a + b, 0) / closed.length) : null,
    profitFactor: closed.length ? (grossLoss === 0 ? (grossWin > 0 ? 99 : null) : r3(grossWin / grossLoss)) : null,
  };
}
