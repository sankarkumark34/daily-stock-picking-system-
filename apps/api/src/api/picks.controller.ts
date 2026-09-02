import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { PickDto } from '@nse/shared';
import { In, IsNull, Repository } from 'typeorm';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { StockEntity } from '../database/entities/stock.entity.js';
import { toPickDto } from './pick-mapper.js';

@ApiTags('picks')
@Controller('picks')
export class PicksController {
  constructor(
    @InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>,
    @InjectRepository(StockEntity) private readonly stocks: Repository<StockEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ranked picks for a date (default: latest live run). Pass runId to browse a backtest.' })
  async list(@Query('date') date?: string, @Query('runId') runId?: string): Promise<{ date: string | null; picks: PickDto[] }> {
    const run = runId ? Number(runId) : null;
    let target = date ?? null;
    if (!target) {
      const latest = await this.predictions.findOne({ where: run ? { runId: run } : { runId: IsNull() }, order: { date: 'DESC' } });
      target = latest?.date ?? null;
    }
    if (!target) return { date: null, picks: [] };
    const rows = await this.predictions.find({ where: { date: target, runId: run ?? IsNull() }, order: { rank: 'ASC' } });
    const names = await this.names(rows.map((r) => r.symbol));
    return { date: target, picks: rows.map((r) => toPickDto(r, names.get(r.symbol) ?? null)) };
  }

  @Get('dates')
  async dates(@Query('runId') runId?: string): Promise<string[]> {
    const qb = this.predictions.createQueryBuilder('p').select('DISTINCT p.date', 'date').orderBy('p.date', 'DESC').limit(600);
    if (runId) qb.where('p."runId" = :r', { r: Number(runId) });
    else qb.where('p."runId" IS NULL');
    const rows: { date: string }[] = await qb.getRawMany();
    return rows.map((r) => r.date);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Most recent live picks across dates (for history tables)' })
  async recent(@Query('limit') limit = '200'): Promise<PickDto[]> {
    const rows = await this.predictions.find({ where: { runId: IsNull() }, order: { date: 'DESC', rank: 'ASC' }, take: Math.min(1000, Number(limit) || 200) });
    const names = await this.names(rows.map((r) => r.symbol));
    return rows.map((r) => toPickDto(r, names.get(r.symbol) ?? null));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number): Promise<PickDto> {
    const row = await this.predictions.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Pick ${id} not found`);
    const names = await this.names([row.symbol]);
    return toPickDto(row, names.get(row.symbol) ?? null);
  }

  private async names(symbols: string[]): Promise<Map<string, string | null>> {
    const uniq = [...new Set(symbols)];
    if (!uniq.length) return new Map();
    const rows = await this.stocks.find({ where: { symbol: In(uniq) }, select: { symbol: true, name: true } });
    return new Map(rows.map((r) => [r.symbol, r.name]));
  }
}
