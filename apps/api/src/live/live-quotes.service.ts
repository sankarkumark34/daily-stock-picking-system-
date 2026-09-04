import { Injectable, Logger } from '@nestjs/common';
import type { LiveMarketDto, LiveQuoteDto } from '@nse/shared';
import { loadConfig } from '../config/app.config.js';

/**
 * Delayed "live" quotes from Yahoo Finance's public chart endpoint (no API key,
 * ~15 minutes delay for NSE). This is a display-only feed: the model itself
 * runs on official NSE end-of-day data. Swap this class for a broker adapter
 * (Upstox / Angel One / Zerodha) to get real-time ticks.
 */
@Injectable()
export class LiveQuotesService {
  readonly source = 'yahoo-delayed';
  readonly delayMinutes = 15;
  private readonly log = new Logger(LiveQuotesService.name);
  private readonly cfg = loadConfig();
  private cache = new Map<string, { at: number; q: LiveQuoteDto | null }>();
  private readonly ttlMs = 60_000;
  private inflight = new Map<string, Promise<LiveQuoteDto | null>>();

  private yahooSymbol(symbol: string): string {
    if (symbol === 'NIFTY 50' || symbol === 'NIFTY') return '^NSEI';
    if (symbol === 'INDIA VIX' || symbol === 'VIX') return '^INDIAVIX';
    if (symbol === 'NIFTY BANK' || symbol === 'BANKNIFTY') return '^NSEBANK';
    return `${symbol.replace(/&/g, '%26')}.NS`;
  }

  /** NSE regular session 09:15–15:30 IST, Mon–Fri (holidays not modelled). */
  private isMarketOpen(now = new Date()): boolean {
    const ist = new Date(now.getTime() + 5.5 * 3600_000);
    const day = ist.getUTCDay();
    if (day === 0 || day === 6) return false;
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  }

  async quote(symbol: string): Promise<LiveQuoteDto | null> {
    const key = symbol.toUpperCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.q;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = this.fetchOne(key)
      .then((q) => {
        this.cache.set(key, { at: Date.now(), q });
        return q;
      })
      .catch((err) => {
        this.log.warn(`quote ${key} failed: ${(err as Error).message}`);
        this.cache.set(key, { at: Date.now() - this.ttlMs + 15_000, q: null }); // retry in 15s
        return null;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async fetchOne(symbol: string): Promise<LiveQuoteDto | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(this.yahooSymbol(symbol))}?interval=1m&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': this.cfg.data.userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown>; indicators?: { quote?: { volume?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; open?: (number | null)[] }[] } }[]; error?: { description?: string } | null };
    };
    const r = json.chart?.result?.[0];
    const m = r?.meta;
    if (!m || typeof m.regularMarketPrice !== 'number') {
      if (json.chart?.error?.description) throw new Error(json.chart.error.description);
      return null;
    }
    const ltp = m.regularMarketPrice as number;
    const prev = (typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : (m.previousClose as number | undefined)) ?? ltp;
    const q = r?.indicators?.quote?.[0];
    const finite = (a?: (number | null)[]) => (a ?? []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const highs = finite(q?.high);
    const lows = finite(q?.low);
    const opens = finite(q?.open);
    const vols = finite(q?.volume);
    const asOf = typeof m.regularMarketTime === 'number' ? new Date((m.regularMarketTime as number) * 1000).toISOString() : new Date().toISOString();
    return {
      symbol,
      ltp,
      prevClose: prev,
      changePct: prev ? Math.round((ltp / prev - 1) * 10000) / 100 : 0,
      dayHigh: highs.length ? Math.max(...highs) : typeof m.regularMarketDayHigh === 'number' ? (m.regularMarketDayHigh as number) : null,
      dayLow: lows.length ? Math.min(...lows) : typeof m.regularMarketDayLow === 'number' ? (m.regularMarketDayLow as number) : null,
      dayOpen: opens.length ? opens[0] : null,
      volume: vols.length ? vols.reduce((a, b) => a + b, 0) : typeof m.regularMarketVolume === 'number' ? (m.regularMarketVolume as number) : null,
      asOf,
      marketOpen: this.isMarketOpen(),
      source: this.source,
      delayMinutes: this.delayMinutes,
    };
  }

  async quotes(symbols: string[]): Promise<LiveQuoteDto[]> {
    const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
    const out: LiveQuoteDto[] = [];
    // modest concurrency to stay polite with the free endpoint
    for (let i = 0; i < uniq.length; i += 6) {
      const batch = await Promise.all(uniq.slice(i, i + 6).map((s) => this.quote(s)));
      for (const q of batch) if (q) out.push(q);
    }
    return out;
  }

  async market(): Promise<LiveMarketDto> {
    const [nifty, vix] = await Promise.all([this.quote('NIFTY 50'), this.quote('INDIA VIX')]);
    return { nifty, vix, marketOpen: this.isMarketOpen(), fetchedAt: new Date().toISOString() };
  }
}
