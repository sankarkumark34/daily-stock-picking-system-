import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AiNoteResponseDto,
  AnalystAnswerDto,
  AnalystVerdict,
  CheckStatus,
  ChecklistItem,
  ConditionalStat,
  HorizonReturn,
  MarketOverviewDto,
  NewsItem,
  SetupType,
  StockAnalysisDto,
  StressStat,
} from '@nse/shared';
import { IsNull, Repository } from 'typeorm';
import { toPickDto } from '../api/pick-mapper.js';
import { loadConfig } from '../config/app.config.js';
import { MarketSnapshotEntity } from '../database/entities/market-snapshot.entity.js';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { StockEntity } from '../database/entities/stock.entity.js';
import { MarketStoreService, type MarketData } from '../engine/market-store.service.js';
import { computeFeatures, snapshotAt } from '../quant/features.js';
import { sma } from '../quant/indicators.js';
import { computeLevels } from '../quant/levels.js';
import { shiftDate } from '../quant/metrics.js';
import { detectSetup } from '../quant/setups.js';
import type { FeatureSeries, IndexSeries, StockSnapshot, SymbolSeries } from '../quant/types.js';
import { AiAnalystService, type AnalystFacts } from './ai-analyst.service.js';
import { NewsService } from './news.service.js';

const r2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return r2(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const mean = (a: number[]) => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : null);
const pctUp = (a: number[]) => (a.length ? r2((a.filter((v) => v > 0).length / a.length) * 100) : null);

const CAVEAT =
  'Rule-based checklist on end-of-day NSE data. The composite model behind this system has NOT shown a statistically positive edge in walk-forward backtests (see Backtest page); treat the verdict as a structured summary of the evidence, not a forecast. AI commentary is generated from public headlines and may be incomplete. Not investment advice.';

@Injectable()
export class AnalystService {
  private readonly log = new Logger(AnalystService.name);
  private readonly cfg = loadConfig();

  constructor(
    private readonly store: MarketStoreService,
    private readonly news: NewsService,
    private readonly ai: AiAnalystService,
    @InjectRepository(StockEntity) private readonly stocks: Repository<StockEntity>,
    @InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>,
    @InjectRepository(MarketSnapshotEntity) private readonly snapshots: Repository<MarketSnapshotEntity>,
  ) {}

  /* ------------------------------------------------------------------ */

  async analyze(symbolRaw: string): Promise<StockAnalysisDto> {
    const { dto } = await this.build(symbolRaw, true);
    return dto;
  }

  async aiNote(symbolRaw: string): Promise<AiNoteResponseDto> {
    const { facts } = await this.build(symbolRaw, true);
    return this.ai.note(facts);
  }

  async ask(symbolRaw: string, question: string): Promise<AnalystAnswerDto> {
    const { facts } = await this.build(symbolRaw, true);
    return this.ai.ask(facts, question);
  }

  /* ------------------------------------------------------------------ */

  private async build(symbolRaw: string, withNews: boolean): Promise<{ dto: StockAnalysisDto; facts: AnalystFacts }> {
    const symbol = symbolRaw.toUpperCase().trim();
    const stock = await this.stocks.findOne({ where: { symbol } });
    const latest = await this.store.latestDate();
    if (!latest) throw new NotFoundException('No market data loaded yet.');
    const data = await this.store.load(shiftDate(latest, -1300), latest, 480, [symbol]);
    const s = data.symbols.get(symbol);
    if (!s || s.dates.length < 60) throw new NotFoundException(`Not enough price history for ${symbol}.`);
    const f = computeFeatures(s);
    const i = s.dates.length - 1;
    const snap = snapshotAt(s, f, i);
    const overview = (await this.snapshots.findOne({ where: {}, order: { date: 'DESC' } }))?.overview ?? null;
    const sectorRow = overview?.sectors.find((x) => x.sector === (stock?.sector ?? s.sector)) ?? null;

    const det = detectSetup(snap);
    const levels = computeLevels(snap, det.setup);
    const returns = this.horizonReturns(s, data.nifty, i);
    const risk = this.riskStats(s, data.nifty, f, i);
    const stress = this.stressStats(s, data);
    const conditional = this.conditionalStats(s, f, snap, det.setup);
    const checklist = this.checklist(snap, overview, sectorRow, levels, risk, det.setup);
    const summary = { pass: 0, warn: 0, fail: 0, na: 0 };
    for (const c of checklist) summary[c.status.toLowerCase() as 'pass' | 'warn' | 'fail' | 'na']++;
    const scored = checklist.filter((c) => c.status !== 'NA');
    const score = scored.length ? Math.round(((summary.pass + 0.5 * summary.warn) / scored.length) * 100) : 0;
    const criticalFail = checklist.some((c) => c.critical && c.status === 'FAIL');
    let verdict: AnalystVerdict = score >= 70 ? 'BUY' : score >= 50 ? 'WATCH' : 'AVOID';
    if (criticalFail && verdict === 'BUY') verdict = 'WATCH';
    if (overview?.regime === 'STRONG_BEARISH' && verdict === 'BUY') verdict = 'WATCH';

    const positives = checklist.filter((c) => c.status === 'PASS').map((c) => `${c.label}: ${c.detail}`);
    const negatives = checklist.filter((c) => c.status === 'FAIL' || c.status === 'WARN').map((c) => `${c.label}: ${c.detail}`);

    let news: NewsItem[] = [];
    let sectorNews: NewsItem[] = [];
    let newsError: string | null = null;
    if (withNews) {
      const company = cleanName(stock?.name) ?? symbol;
      try {
        [news, sectorNews] = await Promise.all([
          this.news.search(`"${company}" stock`, 12),
          (stock?.sector ?? s.sector) !== 'Unclassified' ? this.news.search(`${stock?.sector ?? s.sector} sector India stocks`, 8) : Promise.resolve([]),
        ]);
      } catch (err) {
        newsError = `News unavailable: ${(err as Error).message}`;
      }
    }

    const history = await this.predictions.find({ where: { symbol, runId: IsNull() }, order: { date: 'DESC' }, take: 20 });
    const chg = Number.isFinite(snap.prevClose) ? (snap.close / snap.prevClose - 1) * 100 : null;

    const dto: StockAnalysisDto = {
      symbol,
      name: stock?.name ?? null,
      sector: stock?.sector ?? s.sector,
      industry: stock?.industry ?? null,
      asOf: snap.date,
      price: snap.close,
      changePct: r2(chg),
      verdict,
      score,
      checklist,
      checklistSummary: summary,
      positives,
      negatives,
      returns,
      risk,
      stress,
      conditional,
      liquidity: {
        day: Math.round(snap.turnover),
        week: Math.round(snap.turnover5),
        month: Math.round(snap.turnover21),
        minDay: this.cfg.model.minTurnoverDay,
        minWeek: this.cfg.model.minTurnoverWeek,
        minMonth: this.cfg.model.minTurnoverMonth,
        pass: snap.turnover >= this.cfg.model.minTurnoverDay && snap.turnover5 >= this.cfg.model.minTurnoverWeek && snap.turnover21 >= this.cfg.model.minTurnoverMonth,
      },
      setup: det.setup,
      levels: levels
        ? { entry: levels.entry, target: levels.target, stopLoss: levels.stopLoss, riskReward: levels.riskReward, riskPct: levels.riskPct, rewardPct: levels.rewardPct, holdDays: levels.holdDays }
        : null,
      factors: [],
      regime: overview?.regime ?? null,
      sectorRank: sectorRow?.rank ?? null,
      sectorScore: sectorRow ? r2(sectorRow.score) : null,
      news,
      sectorNews,
      newsError,
      aiAvailable: this.cfg.analyst.enabled,
      pickHistory: history.map((h) => toPickDto(h, stock?.name ?? null)),
      caveat: CAVEAT,
    };

    const facts: AnalystFacts = {
      symbol,
      name: dto.name,
      sector: dto.sector,
      asOf: dto.asOf,
      quant: {
        price: dto.price,
        changePct: dto.changePct,
        verdict: dto.verdict,
        checklistScore: dto.score,
        checklistFailsAndWarnings: negatives,
        checklistPasses: positives,
        setupDetected: dto.setup,
        tradeLevels: dto.levels,
        returnsVsNifty: returns,
        risk,
        behaviourUnderStress: stress,
        whatHistorySays: conditional,
        marketRegime: dto.regime,
        sectorRank: dto.sectorRank,
        sectorScore: dto.sectorScore,
        rsi14: r2(snap.rsi14),
        adx14: r2(snap.adx14),
        atrPct: r2(snap.atrPct),
        relativeVolume: r2(snap.relVol),
        deliveryPct: r2(snap.deliveryPct),
        distanceFrom52wHighPct: r2((snap.close / snap.high252 - 1) * 100),
      },
      news,
      sectorNews,
    };
    return { dto, facts };
  }

  /* ---------------------------- pieces ------------------------------ */

  private horizonReturns(s: SymbolSeries, nifty: IndexSeries | null, i: number): HorizonReturn[] {
    const nIdx = nifty ? new Map(nifty.dates.map((d, k) => [d, k])) : null;
    const nAt = (date: string) => {
      if (!nifty || !nIdx) return null;
      const k = nIdx.get(date);
      return k === undefined ? null : nifty.close[k];
    };
    const out: HorizonReturn[] = [];
    for (const [label, days] of [
      ['1 week', 5],
      ['1 month', 21],
      ['3 months', 63],
      ['6 months', 126],
      ['1 year', 252],
      ['3 years', 756],
    ] as [string, number][]) {
      if (i - days < 0) {
        out.push({ label, days, stock: null, nifty: null, excess: null });
        continue;
      }
      const stock = r2((s.close[i] / s.close[i - days] - 1) * 100);
      const n0 = nAt(s.dates[i - days]);
      const n1 = nAt(s.dates[i]);
      const nf = n0 && n1 ? r2((n1 / n0 - 1) * 100) : null;
      out.push({ label, days, stock, nifty: nf, excess: stock !== null && nf !== null ? r2(stock - nf) : null });
    }
    return out;
  }

  private riskStats(s: SymbolSeries, nifty: IndexSeries | null, f: FeatureSeries, i: number): StockAnalysisDto['risk'] {
    const from = Math.max(1, i - 252);
    const sr: number[] = [];
    const nr: number[] = [];
    const nIdx = nifty ? new Map(nifty.dates.map((d, k) => [d, k])) : null;
    for (let k = from; k <= i; k++) {
      const ret = s.close[k] / s.close[k - 1] - 1;
      if (!Number.isFinite(ret)) continue;
      if (nifty && nIdx) {
        const a = nIdx.get(s.dates[k]);
        const b = nIdx.get(s.dates[k - 1]);
        if (a === undefined || b === undefined) continue;
        nr.push(nifty.close[a] / nifty.close[b] - 1);
      }
      sr.push(ret);
    }
    let beta: number | null = null;
    let corr: number | null = null;
    if (nr.length === sr.length && sr.length > 60) {
      const ms = sr.reduce((a, b) => a + b, 0) / sr.length;
      const mn = nr.reduce((a, b) => a + b, 0) / nr.length;
      let cov = 0;
      let vn = 0;
      let vs = 0;
      for (let k = 0; k < sr.length; k++) {
        cov += (sr[k] - ms) * (nr[k] - mn);
        vn += (nr[k] - mn) ** 2;
        vs += (sr[k] - ms) ** 2;
      }
      beta = vn > 0 ? r2(cov / vn) : null;
      corr = vn > 0 && vs > 0 ? r2(cov / Math.sqrt(vn * vs)) : null;
    }
    const m = sr.length ? sr.reduce((a, b) => a + b, 0) / sr.length : 0;
    const sd = sr.length > 1 ? Math.sqrt(sr.reduce((a, r) => a + (r - m) ** 2, 0) / (sr.length - 1)) : NaN;
    let peak = -Infinity;
    let mdd = 0;
    for (let k = from; k <= i; k++) {
      if (s.close[k] > peak) peak = s.close[k];
      const dd = s.close[k] / peak - 1;
      if (dd < mdd) mdd = dd;
    }
    return {
      beta1y: beta,
      correlation1y: corr,
      annualVolPct: r2(sd * Math.sqrt(252) * 100),
      maxDrawdown1yPct: r2(mdd * 100),
      drawdownFrom52wHighPct: r2((s.close[i] / f.high252[i] - 1) * 100),
      atrPct: r2(f.atrPct[i]),
      avgTurnoverCr: r2(f.avgTurnover20[i] / 1e7),
    };
  }

  /** How the stock behaves on shock days — a proxy for macro / geopolitical sensitivity. */
  private stressStats(s: SymbolSeries, data: MarketData): StressStat[] {
    const nifty = data.nifty;
    if (!nifty) return [];
    const nIdx = new Map(nifty.dates.map((d, k) => [d, k]));
    const vIdx = data.vix ? new Map(data.vix.dates.map((d, k) => [d, k])) : null;
    const nSma200 = sma(nifty.close, 200);
    const from = Math.max(1, s.dates.length - 760);
    type Bucket = { stock: number[]; nifty: number[]; next: number[] };
    const mk = (): Bucket => ({ stock: [], nifty: [], next: [] });
    const b = { down: mk(), up: mk(), vix: mk(), bear: mk(), bull: mk() };
    for (let k = from; k < s.dates.length; k++) {
      const a = nIdx.get(s.dates[k]);
      const p = nIdx.get(s.dates[k - 1]);
      if (a === undefined || p === undefined) continue;
      const sRet = (s.close[k] / s.close[k - 1] - 1) * 100;
      const nRet = (nifty.close[a] / nifty.close[p] - 1) * 100;
      const next = k + 1 < s.dates.length ? (s.close[k + 1] / s.close[k] - 1) * 100 : NaN;
      const push = (bk: Bucket) => {
        bk.stock.push(sRet);
        bk.nifty.push(nRet);
        if (Number.isFinite(next)) bk.next.push(next);
      };
      if (nRet <= -1.5) push(b.down);
      if (nRet >= 1.5) push(b.up);
      if (vIdx && data.vix) {
        const va = vIdx.get(s.dates[k]);
        const vp = vIdx.get(s.dates[k - 1]);
        if (va !== undefined && vp !== undefined && data.vix.close[va] / data.vix.close[vp] - 1 >= 0.1) push(b.vix);
      }
      if (Number.isFinite(nSma200[a])) push(nifty.close[a] < nSma200[a] ? b.bear : b.bull);
    }
    const stat = (id: string, label: string, description: string, bk: Bucket): StressStat => ({
      id,
      label,
      description,
      days: bk.stock.length,
      stockAvg: mean(bk.stock),
      niftyAvg: mean(bk.nifty),
      stockUpPct: pctUp(bk.stock),
      nextDayStockAvg: mean(bk.next),
    });
    return [
      stat('nifty-down', 'NIFTY falls ≥1.5% in a day', 'Shock days (global sell-offs, geopolitical scares). Does this stock fall more or less than the index?', b.down),
      stat('nifty-up', 'NIFTY rises ≥1.5% in a day', 'Relief-rally days. Does the stock participate?', b.up),
      stat('vix-spike', 'India VIX jumps ≥10% in a day', 'Fear spikes — event risk, war headlines, policy surprises.', b.vix),
      stat('bear-phase', 'NIFTY below its 200-day average', 'Average daily return during bearish market phases.', b.bear),
      stat('bull-phase', 'NIFTY above its 200-day average', 'Average daily return during bullish market phases.', b.bull),
    ];
  }

  /** Forward returns in this stock's own history when a similar condition held. */
  private conditionalStats(s: SymbolSeries, f: FeatureSeries, now: StockSnapshot, setup: SetupType): ConditionalStat[] {
    const n = s.dates.length;
    const last = n - 1;
    const fwd = (k: number, d: number) => (k + d < n ? (s.close[k + d] / s.close[k] - 1) * 100 : NaN);
    const conds: { id: string; label: string; description: string; test: (k: number, snap: StockSnapshot | null) => boolean; needSnap: boolean }[] = [];
    if (setup !== 'NONE') {
      conds.push({
        id: 'same-setup',
        label: `After a ${setup.replace('_', ' ').toLowerCase()} signal`,
        description: `Every past day this stock triggered the same setup that is active today.`,
        needSnap: true,
        test: (_k, snap) => !!snap && detectSetup(snap).setup === setup,
      });
    }
    conds.push({
      id: 'rsi-band',
      label: `RSI within ±5 of today (${Number.isFinite(now.rsi14) ? now.rsi14.toFixed(0) : '–'})`,
      description: 'Days when the stock had a similar momentum reading.',
      needSnap: false,
      test: (k) => Math.abs(f.rsi14[k] - now.rsi14) <= 5,
    });
    conds.push({
      id: 'breakout-20d',
      label: 'Close above prior 20-day high',
      description: 'How breakouts in this particular stock have followed through historically.',
      needSnap: false,
      test: (k) => s.close[k] > f.priorHigh20[k],
    });
    conds.push({
      id: 'oversold',
      label: 'RSI below 30 (oversold)',
      description: 'Bounce tendency after washouts in this stock.',
      needSnap: false,
      test: (k) => f.rsi14[k] < 30,
    });
    conds.push({
      id: 'above-200',
      label: 'Trading above the 200-day SMA',
      description: 'Baseline forward returns while the long-term trend was up.',
      needSnap: false,
      test: (k) => s.close[k] > f.sma200[k],
    });
    const out: ConditionalStat[] = [];
    const start = Math.max(220, n - 1300);
    for (const c of conds) {
      const f5: number[] = [];
      const f10: number[] = [];
      const f20: number[] = [];
      let occ = 0;
      let lastHit = -10;
      for (let k = start; k < last - 5; k++) {
        const snap = c.needSnap ? snapshotAt(s, f, k) : null;
        if (!c.test(k, snap)) continue;
        if (k - lastHit < 3) continue; // de-duplicate clustered signals
        lastHit = k;
        occ++;
        const a = fwd(k, 5);
        const b = fwd(k, 10);
        const d = fwd(k, 20);
        if (Number.isFinite(a)) f5.push(a);
        if (Number.isFinite(b)) f10.push(b);
        if (Number.isFinite(d)) f20.push(d);
      }
      if (occ < 5) continue;
      out.push({
        id: c.id,
        label: c.label,
        description: c.description,
        occurrences: occ,
        medianFwd5: median(f5),
        winRate5: pctUp(f5),
        medianFwd10: median(f10),
        winRate10: pctUp(f10),
        medianFwd20: median(f20),
        winRate20: pctUp(f20),
      });
    }
    return out;
  }

  private checklist(
    s: StockSnapshot,
    overview: MarketOverviewDto | null,
    sector: MarketOverviewDto['sectors'][number] | null,
    levels: ReturnType<typeof computeLevels>,
    risk: StockAnalysisDto['risk'],
    setup: SetupType,
  ): ChecklistItem[] {
    const items: ChecklistItem[] = [];
    const add = (id: string, group: string, label: string, status: CheckStatus, value: string, detail: string, critical = false) =>
      items.push({ id, group, label, status, value, detail, critical });
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const fin = (v: number) => Number.isFinite(v);

    // Trend
    const d200 = fin(s.sma200) ? (s.close / s.sma200 - 1) * 100 : NaN;
    add('above-200', 'Trend', 'Above 200-day SMA', !fin(d200) ? 'NA' : d200 > 0 ? 'PASS' : 'FAIL', fin(d200) ? pct(d200) : '–', fin(d200) ? `Price is ${pct(d200)} vs its 200-day average — ${d200 > 0 ? 'long-term uptrend intact' : 'long-term trend is down'}.` : 'Not enough history.', true);
    const stack = [s.ema9 > s.ema21, s.ema21 > s.ema50, s.ema50 > s.sma200].filter(Boolean).length;
    add('ema-stack', 'Trend', 'EMA alignment (9 > 21 > 50 > 200)', stack === 3 ? 'PASS' : stack === 2 ? 'WARN' : 'FAIL', `${stack}/3`, stack === 3 ? 'All moving averages stacked bullishly.' : stack === 2 ? 'Mostly aligned; one average out of order.' : 'Averages are tangled or bearishly stacked.');
    add('adx', 'Trend', 'Trend strength (ADX ≥ 20)', !fin(s.adx14) ? 'NA' : s.adx14 >= 20 ? 'PASS' : s.adx14 >= 15 ? 'WARN' : 'FAIL', fin(s.adx14) ? s.adx14.toFixed(0) : '–', s.adx14 >= 20 ? 'A directional trend is present.' : 'Weak / range-bound price action.');

    // Momentum
    const nifty20 = overview?.nifty.ret20 ?? null;
    const rs = nifty20 === null || !fin(s.ret20) ? NaN : s.ret20 - nifty20;
    add('rs-nifty', 'Momentum', 'Outperforming NIFTY (20d)', !fin(rs) ? 'NA' : rs > 1 ? 'PASS' : rs > -1 ? 'WARN' : 'FAIL', fin(rs) ? pct(rs) : '–', fin(rs) ? `20-day return ${pct(s.ret20)} vs NIFTY ${pct(nifty20!)}.` : 'Run the daily pipeline to get NIFTY context.');
    add('rsi', 'Momentum', 'RSI in a healthy zone (45–70)', !fin(s.rsi14) ? 'NA' : s.rsi14 >= 45 && s.rsi14 <= 70 ? 'PASS' : s.rsi14 > 80 ? 'FAIL' : 'WARN', fin(s.rsi14) ? s.rsi14.toFixed(0) : '–', s.rsi14 > 80 ? 'Severely overbought — chasing here is risky.' : s.rsi14 > 70 ? 'Overbought; momentum strong but stretched.' : s.rsi14 < 40 ? 'Weak momentum / possible oversold bounce candidate.' : 'Momentum positive without being extreme.');
    add('macd', 'Momentum', 'MACD histogram positive', !fin(s.macdHist) ? 'NA' : s.macdHist > 0 ? 'PASS' : 'FAIL', fin(s.macdHist) ? s.macdHist.toFixed(2) : '–', s.macdHist > 0 ? 'Short-term momentum ahead of its signal line.' : 'Momentum below its signal line.');
    add('ret60', 'Momentum', 'Positive 3-month return', !fin(s.ret60) ? 'NA' : s.ret60 > 0 ? 'PASS' : 'FAIL', fin(s.ret60) ? pct(s.ret60) : '–', `60-day return ${fin(s.ret60) ? pct(s.ret60) : '–'}.`);

    // Volume
    add('relvol', 'Volume', 'Volume vs 20-day average', !fin(s.relVol) ? 'NA' : s.relVol >= 1.2 ? 'PASS' : s.relVol >= 0.8 ? 'WARN' : 'FAIL', fin(s.relVol) ? `${s.relVol.toFixed(2)}×` : '–', s.relVol >= 1.2 ? 'Above-average participation confirms the move.' : s.relVol >= 0.8 ? 'Normal volume.' : 'Thin volume — low conviction.');
    add('obv', 'Volume', 'Accumulation (OBV rising)', !fin(s.obvSlope10) ? 'NA' : s.obvSlope10 > 0 ? 'PASS' : 'FAIL', fin(s.obvSlope10) ? s.obvSlope10.toFixed(2) : '–', s.obvSlope10 > 0 ? 'Volume flowing in on up days.' : 'Volume heavier on down days (distribution).');
    add('delivery', 'Volume', 'Delivery % above its average', !fin(s.deliveryPct) || !fin(s.avgDeliveryPct20) ? 'NA' : s.deliveryPct >= s.avgDeliveryPct20 ? 'PASS' : 'WARN', fin(s.deliveryPct) ? `${s.deliveryPct.toFixed(0)}%` : 'n/a', fin(s.deliveryPct) ? `Delivery ${s.deliveryPct.toFixed(0)}% vs 20-day avg ${s.avgDeliveryPct20.toFixed(0)}% — ${s.deliveryPct >= s.avgDeliveryPct20 ? 'investors taking delivery' : 'more intraday churn than usual'}.` : 'Delivery data not available.');

    // Volatility & structure
    add('atr', 'Volatility', 'Tradeable volatility (ATR 1.5–4%)', !fin(s.atrPct) ? 'NA' : s.atrPct >= 1.5 && s.atrPct <= 4 ? 'PASS' : s.atrPct < 1 || s.atrPct > 6 ? 'FAIL' : 'WARN', fin(s.atrPct) ? `${s.atrPct.toFixed(1)}%` : '–', s.atrPct > 4 ? 'High volatility — size positions smaller.' : s.atrPct < 1.5 ? 'Very low volatility — moves may be slow.' : 'Daily range is manageable.');
    const d52 = risk.drawdownFrom52wHighPct;
    add('near-high', 'Structure', 'Near 52-week high', d52 === null ? 'NA' : d52 >= -5 ? 'PASS' : d52 >= -15 ? 'WARN' : 'FAIL', d52 === null ? '–' : pct(d52), d52 === null ? '' : d52 >= -5 ? 'Trading at or near yearly highs — no overhead supply.' : d52 >= -15 ? 'Some distance below the yearly high.' : `Deep below the 52-week high (${pct(d52)}) — heavy overhead resistance.`);
    add('higher-lows', 'Structure', 'Higher swing lows', !fin(s.higherLows) ? 'NA' : s.higherLows >= 1 ? 'PASS' : 'WARN', fin(s.higherLows) ? `${s.higherLows}/2` : '–', s.higherLows >= 1 ? 'Recent pullbacks have held above prior lows.' : 'No higher-low structure yet.');
    const ext = fin(s.ema21) ? (s.close / s.ema21 - 1) * 100 : NaN;
    add('not-extended', 'Structure', 'Not over-extended from EMA21', !fin(ext) ? 'NA' : ext <= 10 ? 'PASS' : ext <= 15 ? 'WARN' : 'FAIL', fin(ext) ? pct(ext) : '–', ext > 10 ? 'Price has run far ahead of its 21-day average; entries here carry pullback risk.' : 'Price close to its short-term mean — reasonable entry zone.');

    // Sector & market
    add('sector', 'Sector', 'Sector among the strongest', !sector ? 'NA' : sector.rank <= 5 ? 'PASS' : sector.rank <= 10 ? 'WARN' : 'FAIL', sector ? `#${sector.rank}` : 'n/a', sector ? `${sector.sector} ranked #${sector.rank} of ${overview?.sectors.length ?? '–'} (score ${sector.score.toFixed(0)}).` : 'Sector not classified (not in Nifty 500 list).');
    const reg = overview?.regime ?? null;
    add('regime', 'Market', 'Market regime supportive for longs', !reg ? 'NA' : reg === 'STRONG_BULLISH' || reg === 'BULLISH' ? 'PASS' : reg === 'SIDEWAYS' ? 'WARN' : 'FAIL', reg ? reg.replace('_', ' ').toLowerCase() : '–', reg ? `Market regime is ${reg.replace('_', ' ').toLowerCase()} (score ${overview!.regimeScore.toFixed(0)}/100).` : 'Run the daily pipeline for regime context.');

    // Liquidity & risk
    const m = this.cfg.model;
    const inr = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString('en-IN')}`);
    const dayOk = s.turnover >= m.minTurnoverDay;
    const weekOk = s.turnover5 >= m.minTurnoverWeek;
    const monthOk = s.turnover21 >= m.minTurnoverMonth;
    const okCount = [dayOk, weekOk, monthOk].filter(Boolean).length;
    add(
      'liquidity',
      'Liquidity',
      `Traded value ≥ ${inr(m.minTurnoverDay)} today, ≥ ${inr(m.minTurnoverWeek)} / 5 sessions, ≥ ${inr(m.minTurnoverMonth)} / 21 sessions`,
      okCount === 3 ? 'PASS' : okCount === 2 ? 'WARN' : 'FAIL',
      `${inr(s.turnover)} · ${inr(s.turnover5)} · ${inr(s.turnover21)}`,
      okCount === 3
        ? 'All three traded-value floors met — enough participation to enter and exit.'
        : `Fails ${[!dayOk && 'today', !weekOk && '5-session', !monthOk && '21-session'].filter(Boolean).join(', ')} floor — thin liquidity, slippage risk.`,
      true,
    );
    add('setup', 'Risk', 'A defined setup is present', setup === 'NONE' ? 'FAIL' : 'PASS', setup === 'NONE' ? 'none' : setup.replace('_', ' ').toLowerCase(), setup === 'NONE' ? 'No breakout / pullback / trend-continuation / reversal pattern today — no clear trigger.' : `${setup.replace('_', ' ').toLowerCase()} pattern detected today.`);
    add('rr', 'Risk', 'Risk / reward ≥ 1.5', !levels ? 'NA' : levels.riskReward >= 1.5 ? 'PASS' : levels.riskReward >= 1.2 ? 'WARN' : 'FAIL', levels ? `${levels.riskReward.toFixed(2)}:1` : '–', levels ? `Target ₹${levels.target} (+${levels.rewardPct}%) vs stop ₹${levels.stopLoss} (−${levels.riskPct}%).` : 'No setup, so no trade plan is computed.');
    add('drawdown', 'Risk', '1-year max drawdown better than −35%', risk.maxDrawdown1yPct === null ? 'NA' : risk.maxDrawdown1yPct > -35 ? 'PASS' : risk.maxDrawdown1yPct > -50 ? 'WARN' : 'FAIL', risk.maxDrawdown1yPct === null ? '–' : pct(risk.maxDrawdown1yPct), risk.maxDrawdown1yPct === null ? '' : `Worst peak-to-trough fall in the last year: ${pct(risk.maxDrawdown1yPct)}.`);
    return items;
  }
}

function cleanName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name
    .replace(/\b(Ltd\.?|Limited|Pvt\.?|Private)\b/gi, '')
    .replace(/[().,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;
}
