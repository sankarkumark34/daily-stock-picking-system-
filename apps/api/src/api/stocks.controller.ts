import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { StockDetailDto } from '@nse/shared';
import { ILike, IsNull, Repository } from 'typeorm';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { StockEntity } from '../database/entities/stock.entity.js';
import { MarketStoreService } from '../engine/market-store.service.js';
import { computeFeatures, snapshotAt } from '../quant/features.js';
import { shiftDate } from '../quant/metrics.js';
import { FEATURE_KEYS } from '../quant/types.js';
import { toPickDto } from './pick-mapper.js';

const toList = (a: Float64Array, from: number) => Array.from(a.subarray(from)).map((v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null));

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(
    private readonly store: MarketStoreService,
    @InjectRepository(StockEntity) private readonly stocks: Repository<StockEntity>,
    @InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>,
  ) {}

  @Get('search')
  async search(@Query('q') q = ''): Promise<{ symbol: string; name: string | null; sector: string }[]> {
    const term = q.trim();
    if (!term) return [];
    const rows = await this.stocks.find({
      where: [{ symbol: ILike(`${term}%`) }, { name: ILike(`%${term}%`) }],
      take: 15,
      order: { inNifty500: 'DESC', symbol: 'ASC' },
    });
    return rows.map((r) => ({ symbol: r.symbol, name: r.name, sector: r.sector }));
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Price history, indicators, latest feature snapshot and pick history for a symbol' })
  async detail(@Param('symbol') symbolRaw: string, @Query('bars') barsQ = '250', @Query('asOf') asOf?: string): Promise<StockDetailDto> {
    const symbol = symbolRaw.toUpperCase();
    const stock = await this.stocks.findOne({ where: { symbol } });
    const latest = asOf ?? (await this.store.latestDate());
    if (!latest) throw new NotFoundException('No market data loaded');
    const data = await this.store.load(shiftDate(latest, -30), latest, 480, [symbol]);
    const s = data.symbols.get(symbol);
    if (!s || !s.dates.length) throw new NotFoundException(`No price history for ${symbol}`);
    const f = computeFeatures(s);
    const n = Math.min(s.dates.length, Math.max(30, Number(barsQ) || 250));
    const from = s.dates.length - n;
    const last = s.dates.length - 1;
    const snap = snapshotAt(s, f, last);
    const latestObj: Record<string, number | string | boolean | null> = {
      date: snap.date,
      close: snap.close,
      changePct: Number.isFinite(snap.prevClose) ? Math.round((snap.close / snap.prevClose - 1) * 10000) / 100 : null,
      sector: snap.sector,
    };
    for (const k of FEATURE_KEYS) latestObj[k] = Number.isFinite(snap[k]) ? Math.round(snap[k] * 1000) / 1000 : null;

    const history = await this.predictions.find({ where: { symbol, runId: IsNull() }, order: { date: 'DESC' }, take: 30 });
    return {
      symbol,
      name: stock?.name ?? s.name,
      sector: stock?.sector ?? s.sector,
      industry: stock?.industry ?? null,
      bars: s.dates.slice(from).map((date, i) => ({
        date,
        open: s.open[from + i],
        high: s.high[from + i],
        low: s.low[from + i],
        close: s.close[from + i],
        volume: s.volume[from + i],
        deliveryPct: Number.isFinite(s.deliveryPct[from + i]) ? s.deliveryPct[from + i] : null,
      })),
      indicators: {
        ema9: toList(f.ema9, from),
        ema21: toList(f.ema21, from),
        ema50: toList(f.ema50, from),
        sma200: toList(f.sma200, from),
        rsi14: toList(f.rsi14, from),
        atr14: toList(f.atr14, from),
      },
      latest: latestObj,
      history: history.map((h) => toPickDto(h, stock?.name ?? null)),
    };
  }
}
