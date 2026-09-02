import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DEFAULT_FACTOR_WEIGHTS,
  DEFAULT_TRADING_COSTS,
  FACTOR_NAMES,
  type BacktestDiagnostics,
  type BacktestMetrics,
  type BacktestParams,
  type BacktestRunDto,
  type BacktestRunSummaryDto,
  type BacktestStatus,
  type FactorWeights,
  type WalkForwardSplitResult,
} from '@nse/shared';
import { Repository } from 'typeorm';
import { BacktestRunEntity } from '../database/entities/backtest-run.entity.js';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { AnalysisService, type Candidate, type DateAnalysis } from '../engine/analysis.service.js';
import { DailyRunService } from '../engine/daily-run.service.js';
import { MarketStoreService } from '../engine/market-store.service.js';
import { roundTripCostPct } from '../quant/costs.js';
import { computeMetrics, dailySeries, equityCurve, groupStats, rollingHitRates, verdictFor } from '../quant/metrics.js';
import { evaluateOutcome, type OutcomeResult } from '../quant/outcome.js';
import type { TradeRecord } from '../quant/types.js';

interface EvaluatedCandidate {
  cand: Candidate;
  outcome: OutcomeResult;
}
interface EvaluatedDate {
  analysis: DateAnalysis;
  items: EvaluatedCandidate[];
}

@Injectable()
export class BacktestService {
  private readonly log = new Logger(BacktestService.name);
  private running = false;

  constructor(
    private readonly store: MarketStoreService,
    private readonly analysis: AnalysisService,
    private readonly daily: DailyRunService,
    @InjectRepository(BacktestRunEntity) private readonly runs: Repository<BacktestRunEntity>,
    @InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>,
  ) {}

  normalise(input: Partial<BacktestParams>): BacktestParams {
    const d = this.daily.defaultOptions();
    const weights = { ...DEFAULT_FACTOR_WEIGHTS, ...(input.weights ?? {}) } as FactorWeights;
    return {
      fromDate: input.fromDate ?? '2019-01-01',
      toDate: input.toDate ?? new Date().toISOString().slice(0, 10),
      maxPicks: input.maxPicks ?? d.maxPicks,
      minScore: input.minScore ?? d.minScore,
      holdDays: input.holdDays ?? 0,
      maxPerSector: input.maxPerSector ?? d.maxPerSector,
      weights: normaliseWeights(weights),
      costs: { ...DEFAULT_TRADING_COSTS, ...(input.costs ?? {}) },
      walkForward: input.walkForward ?? true,
      optimizeWeights: input.optimizeWeights ?? false,
      label: input.label,
    };
  }

  async start(input: Partial<BacktestParams>): Promise<BacktestRunEntity> {
    if (this.running) throw new Error('A backtest is already running');
    const params = this.normalise(input);
    const run = await this.runs.save(
      this.runs.create({
        label: params.label?.trim() || `Backtest ${params.fromDate} → ${params.toDate}`,
        status: 'QUEUED' satisfies BacktestStatus,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        params,
        metrics: null,
        byRegime: null,
        bySetup: null,
        byYear: null,
        daily: null,
        equity: null,
        rolling: null,
        walkForward: null,
        diagnostics: null,
        verdict: null,
        error: null,
        progress: 0,
      }),
    );
    void this.execute(run);
    return run;
  }

  private async execute(run: BacktestRunEntity) {
    this.running = true;
    const t0 = Date.now();
    try {
      run.status = 'RUNNING';
      await this.runs.save(run);
      const p = run.params;

      const data = await this.store.load(p.fromDate, p.toDate);
      const dates = data.tradingDates;
      if (dates.length < 40) throw new Error(`Only ${dates.length} trading dates with data in range — backfill more history first.`);

      const opts = { ...this.daily.defaultOptions(), maxPicks: p.maxPicks, minScore: p.minScore, holdDays: p.holdDays, maxPerSector: p.maxPerSector, weights: p.weights, costs: p.costs };
      let lastSave = Date.now();
      const analyses = this.analysis.analyzeDates(data, dates, opts, (done, total) => {
        run.progress = Math.round((done / total) * 70);
        if (Date.now() - lastSave > 2000) {
          lastSave = Date.now();
          void this.runs.update(run.id, { progress: run.progress });
        }
      });

      // Evaluate every candidate's outcome once (weight independent)
      const evaluated: EvaluatedDate[] = analyses.map((a) => ({
        analysis: a,
        items: a.candidates.map((cand) => {
          const s = data.symbols.get(cand.snap.symbol)!;
          return { cand, outcome: evaluateOutcome(s, cand.snap.idx, cand.levels, p.costs) };
        }),
      }));
      run.progress = 75;
      await this.runs.update(run.id, { progress: 75 });

      // Baseline simulation with the configured weights
      const { trades, picksByDate } = this.simulate(evaluated, p.weights, p);
      const cost = roundTripCostPct(p.costs);
      const metrics = computeMetrics(trades, dates, p.maxPicks, cost);
      const regimeByDate = new Map(analyses.map((a) => [a.date, a.regime.regime]));
      const daily = dailySeries(trades, regimeByDate);

      // Walk-forward
      let wf: WalkForwardSplitResult[] = [];
      if (p.walkForward) wf = this.walkForward(evaluated, dates, p, cost);
      run.progress = 90;
      await this.runs.update(run.id, { progress: 90 });

      // Persist the baseline picks so users can browse "what would have been picked"
      await this.predictions.delete({ runId: run.id });
      const rows: PredictionEntity[] = [];
      for (const [date, picks] of picksByDate) {
        for (const pk of picks) {
          const e = this.daily.toEntity(pk.ranked, date, pk.regime, run.id);
          Object.assign(e, {
            outcome: pk.outcome.outcome,
            outcomeDate: pk.outcome.outcomeDate,
            fillPrice: pk.outcome.fillPrice,
            exitPrice: pk.outcome.exitPrice,
            grossReturnPct: pk.outcome.grossReturnPct,
            netReturnPct: pk.outcome.netReturnPct,
            daysHeld: pk.outcome.daysHeld,
          });
          rows.push(e);
        }
      }
      for (let i = 0; i < rows.length; i += 300) await this.predictions.insert(rows.slice(i, i + 300));

      const oos = wf.length ? aggregateOos(wf) : null;
      run.metrics = metrics;
      run.byRegime = groupStats(trades, (t) => t.regime);
      run.bySetup = groupStats(trades, (t) => t.setup);
      run.byYear = groupStats(trades, (t) => t.date.slice(0, 4)).sort((a, b) => a.key.localeCompare(b.key));
      run.daily = daily;
      run.equity = equityCurve(trades, dates, p.maxPicks);
      run.rolling = rollingHitRates(daily);
      run.walkForward = wf;
      run.diagnostics = buildDiagnostics(evaluated, picksByDate, p.maxPicks);
      run.verdict = verdictFor(metrics, oos);
      run.status = 'COMPLETED';
      run.progress = 100;
      run.finishedAt = new Date().toISOString();
      await this.runs.save(run);
      this.log.log(`Backtest #${run.id} done: ${trades.length} trades, win rate ${metrics.winRate}%, ${Date.now() - t0}ms`);
    } catch (err) {
      this.log.error(`Backtest #${run.id} failed: ${(err as Error).stack}`);
      run.status = 'FAILED';
      run.error = (err as Error).message;
      run.finishedAt = new Date().toISOString();
      await this.runs.save(run);
    } finally {
      this.running = false;
    }
  }

  /** Rank each date with the given weights and turn the picks into trade records. */
  private simulate(evaluated: EvaluatedDate[], weights: FactorWeights, p: BacktestParams, dateFilter?: (d: string) => boolean) {
    const trades: TradeRecord[] = [];
    const picksByDate = new Map<string, { ranked: ReturnType<AnalysisService['rank']>[number]; outcome: OutcomeResult; regime: string }[]>();
    const rates = new Map<string, { w: number; n: number }>();
    const rateMap = () => {
      const m = new Map<string, number | null>();
      for (const [k, v] of rates) m.set(k, v.n >= 30 ? v.w / v.n : null);
      return m;
    };
    for (const ed of evaluated) {
      const date = ed.analysis.date;
      if (dateFilter && !dateFilter(date)) continue;
      const ranked = this.analysis.rank(ed.analysis, { maxPicks: p.maxPicks, minScore: p.minScore, maxPerSector: p.maxPerSector, weights }, rateMap());
      if (!ranked.length) continue;
      const byIdx = new Map(ed.items.map((it) => [it.cand, it.outcome]));
      const list: { ranked: (typeof ranked)[number]; outcome: OutcomeResult; regime: string }[] = [];
      for (const r of ranked) {
        const outcome = byIdx.get(r.candidate)!;
        list.push({ ranked: r, outcome, regime: ed.analysis.regime.regime });
        trades.push({
          date,
          symbol: r.candidate.snap.symbol,
          sector: r.candidate.snap.sector,
          setup: r.candidate.setup,
          regime: ed.analysis.regime.regime,
          outcome: outcome.outcome,
          grossReturnPct: outcome.grossReturnPct,
          netReturnPct: outcome.netReturnPct,
          outcomeDate: outcome.outcomeDate,
          daysHeld: outcome.daysHeld,
        });
        // expanding-window setup success rates (only information available before this date)
        if (outcome.outcome === 'SUCCESS' || outcome.outcome === 'FAILURE' || outcome.outcome === 'EXPIRED') {
          const cur = rates.get(r.candidate.setup) ?? { w: 0, n: 0 };
          cur.n++;
          if (outcome.outcome === 'SUCCESS') cur.w++;
          rates.set(r.candidate.setup, cur);
        }
      }
      picksByDate.set(date, list);
    }
    return { trades, picksByDate };
  }

  /**
   * Anchored walk-forward by calendar year: train on everything before the
   * validation year, validate on Y-1, test on Y. Weights are optimised on the
   * train window only when `optimizeWeights` is set; otherwise the baseline is
   * carried through so the split still reports honest out-of-sample numbers.
   */
  private walkForward(evaluated: EvaluatedDate[], dates: string[], p: BacktestParams, cost: number): WalkForwardSplitResult[] {
    const years = [...new Set(dates.map((d) => d.slice(0, 4)))].sort();
    if (years.length < 3) return [];
    const out: WalkForwardSplitResult[] = [];
    const inRange = (from: string, to: string) => (d: string) => d >= from && d <= to;
    const metricsFor = (weights: FactorWeights, from: string, to: string): BacktestMetrics | null => {
      const { trades } = this.simulate(evaluated, weights, p, inRange(from, to));
      const td = dates.filter(inRange(from, to));
      return td.length ? computeMetrics(trades, td, p.maxPicks, cost) : null;
    };
    for (let i = 2; i < years.length; i++) {
      const trainFrom = `${years[0]}-01-01`;
      const trainTo = `${years[i - 2]}-12-31`;
      const valFrom = `${years[i - 1]}-01-01`;
      const valTo = `${years[i - 1]}-12-31`;
      const testFrom = `${years[i]}-01-01`;
      const testTo = `${years[i]}-12-31`;
      let weights = p.weights;
      if (p.optimizeWeights) {
        const objective = (w: FactorWeights) => {
          const m = metricsFor(w, trainFrom, trainTo);
          if (!m || m.trades < 100) return -Infinity;
          return (m.expectancyPct ?? -99) * Math.min(1, m.trades / 300);
        };
        const optimised = coordinateSearch(p.weights, objective);
        // pick on validation, not on train
        const vBase = metricsFor(p.weights, valFrom, valTo)?.expectancyPct ?? -99;
        const vOpt = metricsFor(optimised, valFrom, valTo)?.expectancyPct ?? -99;
        weights = vOpt > vBase ? optimised : p.weights;
      }
      out.push({
        label: `Train ${years[0]}–${years[i - 2]} → Validate ${years[i - 1]} → Test ${years[i]}`,
        train: { from: trainFrom, to: trainTo, metrics: metricsFor(weights, trainFrom, trainTo) },
        validate: { from: valFrom, to: valTo, metrics: metricsFor(weights, valFrom, valTo) },
        test: { from: testFrom, to: testTo, metrics: metricsFor(weights, testFrom, testTo) },
        weights,
        baselineTestMetrics: p.optimizeWeights ? metricsFor(p.weights, testFrom, testTo) : null,
      });
    }
    return out;
  }

  async list(): Promise<BacktestRunSummaryDto[]> {
    const rows = await this.runs.find({ order: { id: 'DESC' }, select: { id: true, label: true, status: true, createdAt: true, params: true, metrics: true, progress: true } });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      status: r.status as BacktestStatus,
      createdAt: r.createdAt,
      fromDate: r.params.fromDate,
      toDate: r.params.toDate,
      trades: r.metrics?.trades ?? null,
      winRate: r.metrics?.winRate ?? null,
      expectancyPct: r.metrics?.expectancyPct ?? null,
      profitFactor: r.metrics?.profitFactor ?? null,
      progress: r.progress,
    }));
  }

  async get(id: number): Promise<BacktestRunDto> {
    const r = await this.runs.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Backtest run ${id} not found`);
    return {
      id: r.id,
      label: r.label,
      status: r.status as BacktestStatus,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      params: r.params,
      metrics: r.metrics,
      byRegime: r.byRegime ?? [],
      bySetup: r.bySetup ?? [],
      byYear: r.byYear ?? [],
      daily: r.daily ?? [],
      equity: r.equity ?? [],
      rolling: r.rolling ?? [],
      walkForward: r.walkForward ?? [],
      diagnostics: r.diagnostics ?? null,
      verdict: r.verdict ?? '',
      error: r.error,
      progress: r.progress,
    };
  }

  async remove(id: number): Promise<void> {
    await this.predictions.delete({ runId: id });
    await this.runs.delete({ id });
  }
}

export function normaliseWeights(w: FactorWeights): FactorWeights {
  const sum = FACTOR_NAMES.reduce((a, k) => a + Math.max(0, w[k] ?? 0), 0) || 1;
  const out = {} as FactorWeights;
  for (const k of FACTOR_NAMES) out[k] = Math.round(((Math.max(0, w[k] ?? 0) / sum) * 100) * 10) / 10;
  return out;
}

/** Greedy coordinate search: move 5 points between factor pairs while the objective improves. */
function coordinateSearch(start: FactorWeights, objective: (w: FactorWeights) => number, step = 5, maxIter = 40): FactorWeights {
  let best = { ...start };
  let bestVal = objective(best);
  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;
    for (const from of FACTOR_NAMES) {
      if (best[from] < step) continue;
      for (const to of FACTOR_NAMES) {
        if (from === to) continue;
        const cand = { ...best, [from]: best[from] - step, [to]: best[to] + step } as FactorWeights;
        const v = objective(cand);
        if (v > bestVal + 1e-6) {
          best = cand;
          bestVal = v;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

function buildDiagnostics(
  evaluated: EvaluatedDate[],
  picksByDate: Map<string, { ranked: { score: number; candidate: { setup: string } } }[]>,
  maxPicks: number,
): BacktestDiagnostics {
  const candidatesBySetup: Record<string, number> = {};
  const selectedBySetup: Record<string, number> = {};
  const regimeDays: Record<string, number> = {};
  let universe = 0;
  let candidates = 0;
  const scores: number[] = [];
  let fewer = 0;
  for (const ed of evaluated) {
    universe += ed.analysis.universeSize;
    candidates += ed.analysis.candidates.length;
    regimeDays[ed.analysis.regime.regime] = (regimeDays[ed.analysis.regime.regime] ?? 0) + 1;
    for (const c of ed.analysis.candidates) candidatesBySetup[c.setup] = (candidatesBySetup[c.setup] ?? 0) + 1;
    const picks = picksByDate.get(ed.analysis.date) ?? [];
    if (picks.length < maxPicks) fewer++;
    for (const pk of picks) {
      scores.push(pk.ranked.score);
      selectedBySetup[pk.ranked.candidate.setup] = (selectedBySetup[pk.ranked.candidate.setup] ?? 0) + 1;
    }
  }
  scores.sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
  const n = Math.max(1, evaluated.length);
  return {
    analysedDays: evaluated.length,
    avgUniverseSize: Math.round(universe / n),
    avgCandidatesPerDay: Math.round((candidates / n) * 10) / 10,
    candidatesBySetup,
    selectedBySetup,
    selectedScore: scores.length ? { min: scores[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: scores[scores.length - 1] } : null,
    daysWithFewerThanMax: fewer,
    regimeDays,
  };
}

function aggregateOos(wf: WalkForwardSplitResult[]): BacktestMetrics | null {
  const tests = wf.map((s) => s.test.metrics).filter((m): m is BacktestMetrics => !!m && m.trades > 0);
  if (!tests.length) return null;
  const trades = tests.reduce((a, m) => a + m.trades, 0);
  const wAvg = (f: (m: BacktestMetrics) => number | null) => {
    let s = 0;
    let n = 0;
    for (const m of tests) {
      const v = f(m);
      if (v === null) continue;
      s += v * m.trades;
      n += m.trades;
    }
    return n ? Math.round((s / n) * 1000) / 1000 : null;
  };
  return {
    ...tests[0],
    trades,
    winRate: wAvg((m) => m.winRate),
    expectancyPct: wAvg((m) => m.expectancyPct),
    profitFactor: wAvg((m) => m.profitFactor),
    directionalAccuracy: wAvg((m) => m.directionalAccuracy),
  };
}
