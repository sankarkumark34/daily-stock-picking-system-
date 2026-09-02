import { Injectable, Logger } from '@nestjs/common';
import type { FactorName, FactorScore, FactorWeights, MarketOverviewDto, SectorStrengthDto, SetupType, TradingCostConfig } from '@nse/shared';
import { computeFeatures, snapshotAt } from '../quant/features.js';
import { computeBreadth, computeIndexFeatures, computeRegime, type IndexFeatures } from '../quant/regime.js';
import { computeSectorStrength } from '../quant/sector.js';
import { detectSetup } from '../quant/setups.js';
import { computeLevels } from '../quant/levels.js';
import { applyWeights, buildReasons, computeRawFactors, confidenceFrom, CrossSection } from '../quant/scoring.js';
import type { RegimeResult, StockSnapshot, TradeLevels } from '../quant/types.js';
import type { MarketData } from './market-store.service.js';

export interface AnalyzeOptions {
  maxPicks: number;
  minScore: number;
  /** 0 → use the per-setup default holding period */
  holdDays: number;
  maxPerSector: number;
  weights: FactorWeights;
  costs: TradingCostConfig;
  minAvgTurnoverCr: number;
  minPrice: number;
  minHistoryBars: number;
}

export interface Candidate {
  snap: StockSnapshot;
  setup: Exclude<SetupType, 'NONE'>;
  evidence: string[];
  levels: TradeLevels;
  raw: Record<FactorName, number>;
  notes: Record<FactorName, string>;
  sector: SectorStrengthDto | undefined;
}

export interface DateAnalysis {
  date: string;
  regime: RegimeResult;
  sectors: SectorStrengthDto[];
  candidates: Candidate[];
  universeSize: number;
}

export interface RankedPick {
  candidate: Candidate;
  rank: number;
  score: number;
  confidence: number;
  factors: FactorScore[];
  reasons: string[];
  setupSuccessRate: number | null;
}

const CHUNK_DATES = 120;

/**
 * The single analysis pipeline used by both the live daily run and the backtester.
 * For each date: universe filter → breadth → regime → sector strength → setups →
 * levels → weight-independent raw factor scores. Weights are applied later in
 * `rank()` so backtests can re-weight without recomputing.
 */
@Injectable()
export class AnalysisService {
  private readonly log = new Logger(AnalysisService.name);

  /**
   * Async so the event loop is yielded between symbols/dates: a multi-year run
   * takes minutes of CPU and must not freeze the HTTP server or block progress writes.
   */
  async analyzeDates(data: MarketData, dates: string[], opts: AnalyzeOptions, onProgress?: (done: number, total: number) => void): Promise<DateAnalysis[]> {
    const results: DateAnalysis[] = [];
    const yieldLoop = () => new Promise<void>((r) => setImmediate(r));
    let sinceYield = 0;
    if (!data.nifty) throw new Error('NIFTY 50 index history is required for regime detection. Ingest index data first.');
    const niftyFeat = computeIndexFeatures(data.nifty);
    const niftyIdx = new Map<string, number>();
    data.nifty.dates.forEach((d, i) => niftyIdx.set(d, i));
    const vixIdx = new Map<string, number>();
    data.vix?.dates.forEach((d, i) => vixIdx.set(d, i));

    const minTurnover = opts.minAvgTurnoverCr * 1e7;
    let done = 0;
    for (let c = 0; c < dates.length; c += CHUNK_DATES) {
      const chunk = dates.slice(c, c + CHUNK_DATES);
      const chunkSet = new Map<string, StockSnapshot[]>();
      for (const d of chunk) chunkSet.set(d, []);

      // Pass 1: per symbol → snapshots for each date in the chunk (only if it passes the universe filter)
      for (const s of data.symbols.values()) {
        if (++sinceYield % 40 === 0) await yieldLoop();
        if (s.dates.length < opts.minHistoryBars) continue;
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        if (s.dates[s.dates.length - 1] < first || s.dates[0] > last) continue;
        const f = computeFeatures(s);
        let i = lowerBound(s.dates, first);
        for (; i < s.dates.length && s.dates[i] <= last; i++) {
          const bucket = chunkSet.get(s.dates[i]);
          if (!bucket) continue;
          if (i + 1 < opts.minHistoryBars) continue;
          if (s.close[i] < opts.minPrice) continue;
          if (!(f.avgTurnover20[i] >= minTurnover)) continue;
          bucket.push(snapshotAt(s, f, i));
        }
      }

      // Pass 2: per date
      for (const date of chunk) {
        await yieldLoop();
        const snaps = chunkSet.get(date) ?? [];
        const ni = niftyIdx.get(date);
        if (ni === undefined || snaps.length < 20) {
          done++;
          continue;
        }
        results.push(this.analyzeDate(date, snaps, data, niftyFeat, ni, vixIdx.get(date) ?? -1, opts));
        done++;
        onProgress?.(done, dates.length);
      }
      chunkSet.clear();
    }
    return results;
  }

  private analyzeDate(
    date: string,
    snaps: StockSnapshot[],
    data: MarketData,
    niftyFeat: IndexFeatures,
    ni: number,
    vi: number,
    opts: AnalyzeOptions,
  ): DateAnalysis {
    const breadth = computeBreadth(snaps);
    const regime = computeRegime(data.nifty!, niftyFeat, ni, data.vix, vi, breadth);
    const sectors = computeSectorStrength(date, snaps, regime.nifty.ret5, regime.nifty.ret20);
    const sectorMap = new Map(sectors.map((s) => [s.sector, s]));
    const cs = new CrossSection(snaps, regime.nifty.ret20, regime.nifty.ret60);

    const candidates: Candidate[] = [];
    for (const snap of snaps) {
      const det = detectSetup(snap);
      if (det.setup === 'NONE') continue;
      const levels = computeLevels(snap, det.setup, opts.holdDays > 0 ? opts.holdDays : undefined);
      if (!levels) continue;
      const sector = sectorMap.get(snap.sector);
      const { raw, notes } = computeRawFactors({ snap, setup: det.setup, cs, sector, regime, levels, fundamentals: null });
      candidates.push({ snap, setup: det.setup, evidence: det.evidence, levels, raw, notes, sector });
    }
    return { date, regime, sectors, candidates, universeSize: snaps.length };
  }

  /** Apply weights, thresholds, regime gating and sector diversification → ranked picks. */
  rank(a: DateAnalysis, opts: Pick<AnalyzeOptions, 'maxPicks' | 'minScore' | 'maxPerSector' | 'weights'>, setupRates: Map<string, number | null>): RankedPick[] {
    const scored = a.candidates.map((cand) => {
      const { total, factors } = applyWeights(cand.raw, opts.weights, cand.notes);
      return { cand, total, factors };
    });
    scored.sort((x, y) => y.total - x.total || y.cand.levels.riskReward - x.cand.levels.riskReward);

    const perSector = new Map<string, number>();
    const out: RankedPick[] = [];
    const bearish = a.regime.regime === 'STRONG_BEARISH';
    const minScore = bearish ? opts.minScore + 8 : opts.minScore;
    for (const s of scored) {
      if (out.length >= opts.maxPicks) break;
      if (s.total < minScore) break;
      if (bearish && s.cand.setup === 'REVERSAL') continue; // no catching knives in a crash
      const sec = s.cand.snap.sector;
      const cnt = perSector.get(sec) ?? 0;
      if (sec !== 'Unclassified' && cnt >= opts.maxPerSector) continue;
      perSector.set(sec, cnt + 1);
      const rate = setupRates.get(s.cand.setup) ?? null;
      out.push({
        candidate: s.cand,
        rank: out.length + 1,
        score: s.total,
        confidence: confidenceFrom(s.total, s.cand.raw, rate, a.regime.longBias),
        factors: s.factors,
        reasons: buildReasons(s.cand.evidence, s.factors, a.regime, s.cand.sector),
        setupSuccessRate: rate,
      });
    }
    return out;
  }

  toOverview(a: DateAnalysis): MarketOverviewDto {
    const r = a.regime;
    return {
      date: a.date,
      regime: r.regime,
      volatilityRegime: r.volatilityRegime,
      regimeScore: Math.round(r.regimeScore * 10) / 10,
      longBias: r.longBias,
      nifty: {
        close: r.nifty.close,
        changePct: round(r.nifty.changePct),
        ret5: round(r.nifty.ret5),
        ret20: round(r.nifty.ret20),
        ret60: round(r.nifty.ret60),
        aboveEma21: r.nifty.aboveEma21,
        aboveSma50: r.nifty.aboveSma50,
        aboveSma200: r.nifty.aboveSma200,
      },
      vix: r.vix ? { close: round(r.vix.close), changePct: round(r.vix.changePct), avg60: round(r.vix.avg60) } : null,
      breadth: {
        advances: r.breadth.advances,
        declines: r.breadth.declines,
        unchanged: r.breadth.unchanged,
        advanceDeclineRatio: round(r.breadth.advanceDeclineRatio),
        pctAboveSma50: round(r.breadth.pctAboveSma50),
        pctAboveSma200: round(r.breadth.pctAboveSma200),
        pctAboveEma21: round(r.breadth.pctAboveEma21),
        newHighs20: r.breadth.newHighs20,
        newLows20: r.breadth.newLows20,
      },
      universeSize: a.universeSize,
      sectors: a.sectors.map((s) => ({
        ...s,
        score: round(s.score),
        momentum5: round(s.momentum5),
        momentum20: round(s.momentum20),
        relativeStrength20: round(s.relativeStrength20),
        breadthAboveEma21: round(s.breadthAboveEma21),
        breadthRisingEma21: round(s.breadthRisingEma21),
        relativeVolume: round(s.relativeVolume),
      })),
      notes: r.notes,
    };
  }
}

const round = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

function lowerBound(arr: string[], v: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
