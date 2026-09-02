import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataStatusDto, IngestLogDto } from '@nse/shared';
import { DataSource, Repository } from 'typeorm';
import { DailyBarEntity } from '../database/entities/daily-bar.entity.js';
import { IndexBarEntity } from '../database/entities/index-bar.entity.js';
import { IngestLogEntity } from '../database/entities/ingest-log.entity.js';
import { StockEntity } from '../database/entities/stock.entity.js';
import { JobsService } from '../engine/jobs.service.js';
import { MARKET_DATA_PROVIDER, type MarketDataProvider } from './providers/market-data.provider.js';

const CHUNK = 400;

@Injectable()
export class DataService {
  private readonly log = new Logger(DataService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProvider,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(StockEntity) private readonly stocks: Repository<StockEntity>,
    @InjectRepository(DailyBarEntity) private readonly bars: Repository<DailyBarEntity>,
    @InjectRepository(IndexBarEntity) private readonly indexBars: Repository<IndexBarEntity>,
    @InjectRepository(IngestLogEntity) private readonly logs: Repository<IngestLogEntity>,
    private readonly jobs: JobsService,
  ) {}

  /** Pull the Nifty 500 constituent list and map symbol → sector (industry). */
  async syncUniverse(): Promise<number> {
    const members = await this.provider.fetchUniverse();
    if (!members.length) return 0;
    for (const m of members) {
      const existing = await this.stocks.findOne({ where: { symbol: m.symbol } });
      if (existing) {
        existing.name = m.name || existing.name;
        existing.sector = m.industry;
        existing.industry = m.industry;
        existing.inNifty500 = true;
        existing.isin = m.isin ?? existing.isin;
        await this.stocks.save(existing);
      } else {
        await this.stocks.insert({
          symbol: m.symbol,
          name: m.name,
          isin: m.isin,
          sector: m.industry,
          industry: m.industry,
          inNifty500: true,
          firstDate: null,
          lastDate: null,
        });
      }
    }
    await this.writeLog(new Date().toISOString().slice(0, 10), 'universe', 'OK', members.length, `${members.length} Nifty 500 members mapped`);
    return members.length;
  }

  async isIngested(date: string): Promise<boolean> {
    const row = await this.logs.findOne({ where: { date, source: 'equity' }, order: { id: 'DESC' } });
    return !!row && (row.status === 'OK' || row.status === 'EMPTY');
  }

  /**
   * Ingest one trading date: equity bhavcopy + index closes + delivery data.
   * Returns number of equity rows stored (0 = holiday / not published yet).
   */
  async ingestDate(date: string, force = false): Promise<number> {
    if (!force && (await this.isIngested(date))) {
      const cnt = await this.bars.count({ where: { date } });
      return cnt;
    }
    let equity;
    try {
      equity = await this.provider.fetchEquityBars(date);
    } catch (err) {
      await this.writeLog(date, 'equity', 'ERROR', 0, (err as Error).message);
      throw err;
    }
    if (!equity.length) {
      await this.writeLog(date, 'equity', 'EMPTY', 0, 'No bhavcopy for this date (holiday or not yet published)');
      return 0;
    }

    const delivery = await this.provider.fetchDelivery(date);
    const rows = equity
      .filter((b) => Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && b.close > 0 && b.high >= b.low)
      .map((b) => {
        const d = delivery.get(b.symbol);
        return {
          symbol: b.symbol,
          date,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          prevClose: Number.isFinite(b.prevClose) ? b.prevClose : b.open,
          volume: Number.isFinite(b.volume) ? b.volume : 0,
          turnover: Number.isFinite(b.turnover) ? b.turnover : 0,
          trades: b.trades,
          deliveryQty: d ? d.deliveryQty : null,
          deliveryPct: d ? d.deliveryPct : null,
        };
      });

    await this.ds.transaction(async (em) => {
      await em.delete(DailyBarEntity, { date });
      for (let i = 0; i < rows.length; i += CHUNK) await em.insert(DailyBarEntity, rows.slice(i, i + CHUNK));
    });
    await this.registerSymbols(equity.map((b) => ({ symbol: b.symbol, isin: b.isin })), date);
    await this.writeLog(date, 'equity', 'OK', rows.length, delivery.size ? `${delivery.size} delivery rows merged` : 'delivery data unavailable');

    try {
      const idx = await this.provider.fetchIndexBars(date);
      if (idx.length) {
        await this.ds.transaction(async (em) => {
          await em.delete(IndexBarEntity, { date });
          for (let i = 0; i < idx.length; i += CHUNK) await em.insert(IndexBarEntity, idx.slice(i, i + CHUNK));
        });
        await this.writeLog(date, 'indices', 'OK', idx.length, null);
      } else {
        await this.writeLog(date, 'indices', 'EMPTY', 0, 'index close file missing');
      }
    } catch (err) {
      await this.writeLog(date, 'indices', 'ERROR', 0, (err as Error).message);
    }
    return rows.length;
  }

  /** Make sure every traded symbol has a stocks row and keep first/last seen dates fresh. */
  private async registerSymbols(list: { symbol: string; isin: string | null }[], date: string) {
    const existing = new Set((await this.stocks.find({ select: { symbol: true } })).map((s) => s.symbol));
    const fresh = list.filter((s) => !existing.has(s.symbol));
    for (let i = 0; i < fresh.length; i += CHUNK) {
      await this.stocks.insert(
        fresh.slice(i, i + CHUNK).map((s) => ({
          symbol: s.symbol,
          name: null,
          isin: s.isin,
          sector: 'Unclassified',
          industry: null,
          inNifty500: false,
          firstDate: date,
          lastDate: date,
        })),
      );
    }
    const q = this.ds.options.type === 'postgres' ? '$1' : '?';
    await this.ds.query(
      `UPDATE stocks SET "lastDate" = ${q} WHERE symbol IN (SELECT symbol FROM daily_bars WHERE date = ${q}) AND ("lastDate" IS NULL OR "lastDate" < ${q})`,
      [date, date, date],
    );
    await this.ds.query(
      `UPDATE stocks SET "firstDate" = ${q} WHERE symbol IN (SELECT symbol FROM daily_bars WHERE date = ${q}) AND ("firstDate" IS NULL OR "firstDate" > ${q})`,
      [date, date, date],
    );
  }

  /** Background backfill of a date range (weekdays only, skips already-ingested dates). */
  startBackfill(fromDate: string, toDate: string, force = false): string {
    const dates = weekdaysBetween(fromDate, toDate);
    const job = this.jobs.start('BACKFILL', fromDate, toDate, dates.length);
    void (async () => {
      let done = 0;
      let stored = 0;
      let empty = 0;
      let errors = 0;
      try {
        if (!(await this.stocks.count({ where: { inNifty500: true } }))) await this.syncUniverse().catch(() => 0);
        for (const d of dates) {
          this.jobs.progress(done, d, `stored ${stored} days, ${empty} holidays, ${errors} errors`);
          try {
            const n = await this.ingestDate(d, force);
            if (n > 0) stored++;
            else empty++;
          } catch (err) {
            errors++;
            this.log.warn(`backfill ${d} failed: ${(err as Error).message}`);
          }
          done++;
        }
        this.jobs.progress(done, null);
        this.jobs.finish(`Backfill complete: ${stored} trading days stored, ${empty} non-trading days, ${errors} errors`);
      } catch (err) {
        this.jobs.fail(err);
      }
    })();
    return job.id;
  }

  async status(): Promise<DataStatusDto> {
    const [symbols, bars, indexBars, sectorsMapped] = await Promise.all([
      this.stocks.count(),
      this.bars.count(),
      this.indexBars.count(),
      this.stocks.count({ where: { inNifty500: true } }),
    ]);
    const range: { first: string | null; last: string | null }[] = await this.ds.query(`SELECT MIN(date) AS first, MAX(date) AS last FROM daily_bars`);
    const days: { n: number }[] = await this.ds.query(`SELECT COUNT(DISTINCT date) AS n FROM daily_bars`);
    const preds: { n: number }[] = await this.ds.query(`SELECT COUNT(*) AS n FROM predictions WHERE "runId" IS NULL`);
    const recent = await this.logs.find({ order: { id: 'DESC' }, take: 25 });
    return {
      symbols,
      bars,
      indexBars,
      firstDate: range[0]?.first ?? null,
      lastDate: range[0]?.last ?? null,
      tradingDays: Number(days[0]?.n ?? 0),
      predictions: Number(preds[0]?.n ?? 0),
      sectorsMapped,
      job: this.jobs.get(),
      recentLogs: recent.map(toLogDto),
    };
  }

  private async writeLog(date: string, source: string, status: 'OK' | 'EMPTY' | 'ERROR', rows: number, message: string | null) {
    await this.logs.insert({ date, source, status, rows, message, createdAt: new Date().toISOString() });
  }
}

export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function toLogDto(l: IngestLogEntity): IngestLogDto {
  return { id: l.id, date: l.date, source: l.source, status: l.status, rows: l.rows, message: l.message, createdAt: l.createdAt };
}
