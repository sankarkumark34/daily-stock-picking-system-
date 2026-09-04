import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { StockDetailDto } from '@nse/shared';
import { IsNull, Repository } from 'typeorm';
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
  @ApiOperation({ summary: 'Autocomplete: every token must match the symbol (prefix) or company name (anywhere); only actively traded symbols' })
  async search(@Query('q') q = ''): Promise<{ symbol: string; name: string | null; sector: string; nifty500: boolean }[]> {
    const tokens = q
      .toLowerCase()
      .split(/[\s,.\-&()]+/)
      .filter(Boolean)
      .slice(0, 4);
    if (!tokens.length) return [];
    const latest = await this.store.latestDate();
    const qb = this.stocks.createQueryBuilder('s');
    if (latest) qb.where('s.lastDate >= :cutoff', { cutoff: shiftDate(latest, -20) });
    tokens.forEach((t, i) => qb.andWhere(`(LOWER(s.symbol) LIKE :p${i} OR LOWER(COALESCE(s.name, '')) LIKE :c${i})`, { [`p${i}`]: `${t}%`, [`c${i}`]: `%${t}%` }));
    const rows = await qb.take(60).getMany();
    const first = tokens[0];
    const whole = tokens.join(' ');
    const rank = (r: StockEntity) => {
      const sym = r.symbol.toLowerCase();
      const name = (r.name ?? '').toLowerCase();
      let score = 0;
      if (sym === whole) score += 1000;
      else if (sym.startsWith(first)) score += 400 - sym.length;
      if (name.startsWith(whole)) score += 300;
      else if (name.split(/\s+/).some((w) => w.startsWith(first))) score += 150;
      if (r.inNifty500) score += 200;
      if (r.name) score += 50;
      if (/ETF|BEES|IETF|GOLD|LIQUID|NIFTY|SENSEX|INDEX|FUND/i.test(`${r.symbol} ${r.name ?? ''}`)) score -= 250;
      return score;
    };
    return rows
      .sort((a, b) => rank(b) - rank(a) || a.symbol.localeCompare(b.symbol))
      .slice(0, 12)
      .map((r) => ({ symbol: r.symbol, name: r.name, sector: r.sector, nifty500: r.inNifty500 }));
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
