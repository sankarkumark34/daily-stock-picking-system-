import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { IndexSeries, SymbolSeries } from '../quant/types.js';
import { shiftDate } from '../quant/metrics.js';

export interface MarketData {
  symbols: Map<string, SymbolSeries>;
  nifty: IndexSeries | null;
  vix: IndexSeries | null;
  /** All trading dates in the loaded window (from NIFTY, falling back to equity bars). */
  tradingDates: string[];
  fromDate: string;
  toDate: string;
}

interface RawBarRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  deliveryPct: number | null;
}

/** Loads column-oriented price history from the database into memory. */
@Injectable()
export class MarketStoreService {
  private readonly log = new Logger(MarketStoreService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async tradingDates(fromDate?: string, toDate?: string): Promise<string[]> {
    const params: string[] = [];
    let where = `"indexName" = 'Nifty 50'`;
    if (fromDate) {
      params.push(fromDate);
      where += ` AND date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      where += ` AND date <= $${params.length}`;
    }
    let rows: { date: string }[] = await this.ds.query(this.sql(`SELECT date FROM index_bars WHERE ${where} ORDER BY date`), params);
    if (!rows.length) {
      rows = await this.ds.query(
        this.sql(`SELECT DISTINCT date FROM daily_bars ${fromDate || toDate ? 'WHERE ' + where.replace(`"indexName" = 'Nifty 50' AND `, '') : ''} ORDER BY date`),
        params,
      );
    }
    return rows.map((r) => r.date);
  }

  async latestDate(): Promise<string | null> {
    const rows: { d: string | null }[] = await this.ds.query(`SELECT MAX(date) AS d FROM daily_bars`);
    return rows[0]?.d ?? null;
  }

  /**
   * Load everything needed to analyse dates in [fromDate, toDate]. `warmupDays`
   * calendar days of extra history are loaded before fromDate so indicators are defined.
   */
  async load(fromDate: string, toDate: string, warmupDays = 480, symbols?: string[]): Promise<MarketData> {
    const t0 = Date.now();
    const loadFrom = shiftDate(fromDate, -warmupDays);
    const sectors = new Map<string, { sector: string; name: string | null }>();
    const stockRows: { symbol: string; sector: string; name: string | null }[] = await this.ds.query(`SELECT symbol, sector, name FROM stocks`);
    for (const r of stockRows) sectors.set(r.symbol, { sector: r.sector, name: r.name });

    const symbolRows: { symbol: string }[] = symbols
      ? symbols.map((s) => ({ symbol: s }))
      : await this.ds.query(this.sql(`SELECT DISTINCT symbol FROM daily_bars WHERE date >= $1 AND date <= $2`), [loadFrom, toDate]);
    const allSymbols = symbolRows.map((r) => r.symbol);

    const out = new Map<string, SymbolSeries>();
    const batch = 150;
    for (let i = 0; i < allSymbols.length; i += batch) {
      const slice = allSymbols.slice(i, i + batch);
      const placeholders = slice.map((_, k) => `$${k + 3}`).join(',');
      const rows: RawBarRow[] = await this.ds.query(
        this.sql(
          `SELECT symbol, date, open, high, low, close, volume, turnover, "deliveryPct" FROM daily_bars WHERE date >= $1 AND date <= $2 AND symbol IN (${placeholders}) ORDER BY symbol, date`,
        ),
        [loadFrom, toDate, ...slice],
      );
      let cur: RawBarRow[] = [];
      const flush = () => {
        if (!cur.length) return;
        const sym = cur[0].symbol;
        const meta = sectors.get(sym);
        out.set(sym, this.toSeries(sym, meta?.name ?? null, meta?.sector ?? 'Unclassified', cur));
        cur = [];
      };
      for (const r of rows) {
        if (cur.length && cur[0].symbol !== r.symbol) flush();
        cur.push(r);
      }
      flush();
    }

    const nifty = await this.loadIndex('Nifty 50', loadFrom, toDate);
    const vix = await this.loadIndex('India VIX', loadFrom, toDate);
    let tradingDates = nifty ? nifty.dates.filter((d) => d >= fromDate && d <= toDate) : [];
    if (!tradingDates.length) {
      const set = new Set<string>();
      for (const s of out.values()) for (const d of s.dates) if (d >= fromDate && d <= toDate) set.add(d);
      tradingDates = [...set].sort();
    }
    this.log.log(`Loaded ${out.size} symbols, ${tradingDates.length} trading dates (${fromDate}→${toDate}) in ${Date.now() - t0}ms`);
    return { symbols: out, nifty, vix, tradingDates, fromDate, toDate };
  }

  async loadIndex(name: string, fromDate: string, toDate: string): Promise<IndexSeries | null> {
    const rows: { date: string; close: number }[] = await this.ds.query(
      this.sql(`SELECT date, close FROM index_bars WHERE "indexName" = $1 AND date >= $2 AND date <= $3 ORDER BY date`),
      [name, fromDate, toDate],
    );
    if (!rows.length) return null;
    return { name, dates: rows.map((r) => r.date), close: Float64Array.from(rows.map((r) => Number(r.close))) };
  }

  private toSeries(symbol: string, name: string | null, sector: string, rows: RawBarRow[]): SymbolSeries {
    const n = rows.length;
    const s: SymbolSeries = {
      symbol,
      name,
      sector,
      dates: new Array(n),
      open: new Float64Array(n),
      high: new Float64Array(n),
      low: new Float64Array(n),
      close: new Float64Array(n),
      volume: new Float64Array(n),
      turnover: new Float64Array(n),
      deliveryPct: new Float64Array(n),
    };
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      s.dates[i] = r.date;
      s.open[i] = Number(r.open);
      s.high[i] = Number(r.high);
      s.low[i] = Number(r.low);
      s.close[i] = Number(r.close);
      s.volume[i] = Number(r.volume);
      s.turnover[i] = Number(r.turnover);
      s.deliveryPct[i] = r.deliveryPct === null || r.deliveryPct === undefined ? NaN : Number(r.deliveryPct);
    }
    return s;
  }

  /** Convert $n placeholders to ? for sqlite drivers. */
  sql(q: string): string {
    return this.ds.options.type === 'postgres' ? q : q.replace(/\$\d+/g, '?');
  }
}
