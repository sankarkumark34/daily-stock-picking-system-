import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DEFAULT_FACTOR_WEIGHTS, DEFAULT_TRADING_COSTS, type DailyRunResultDto } from '@nse/shared';
import { IsNull, Repository } from 'typeorm';
import { toPickDto } from '../api/pick-mapper.js';
import { loadConfig } from '../config/app.config.js';
import { DataService } from '../data/data.service.js';
import { MarketSnapshotEntity } from '../database/entities/market-snapshot.entity.js';
import { PredictionEntity } from '../database/entities/prediction.entity.js';
import { StockEntity } from '../database/entities/stock.entity.js';
import { evaluateOutcome } from '../quant/outcome.js';
import { shiftDate } from '../quant/metrics.js';
import { AnalysisService, type AnalyzeOptions, type RankedPick } from './analysis.service.js';
import { JobsService } from './jobs.service.js';
import { MarketStoreService } from './market-store.service.js';

/**
 * Orchestrates the end-of-day pipeline:
 * ingest → load → analyse → rank → persist picks + market snapshot → evaluate open predictions.
 */
@Injectable()
export class DailyRunService {
  private readonly log = new Logger(DailyRunService.name);
  private readonly cfg = loadConfig();

  constructor(
    private readonly data: DataService,
    private readonly store: MarketStoreService,
    private readonly analysis: AnalysisService,
    private readonly jobs: JobsService,
    @InjectRepository(PredictionEntity) private readonly predictions: Repository<PredictionEntity>,
    @InjectRepository(MarketSnapshotEntity) private readonly snapshots: Repository<MarketSnapshotEntity>,
    @InjectRepository(StockEntity) private readonly stocks: Repository<StockEntity>,
  ) {}

  defaultOptions(): AnalyzeOptions {
    const m = this.cfg.model;
    return {
      maxPicks: m.maxPicks,
      minScore: m.minScore,
      holdDays: 0,
      maxPerSector: m.maxPerSector,
      weights: DEFAULT_FACTOR_WEIGHTS,
      costs: DEFAULT_TRADING_COSTS,
      minAvgTurnoverCr: m.minAvgTurnoverCr,
      minPrice: m.minPrice,
      minHistoryBars: m.minHistoryBars,
    };
  }

  /** Historical success rate per setup from every closed prediction (live + backtests). */
  async setupSuccessRates(beforeDate?: string): Promise<Map<string, number | null>> {
    const qb = this.predictions
      .createQueryBuilder('p')
      .select('p.setup', 'setup')
      .addSelect(`SUM(CASE WHEN p.outcome = 'SUCCESS' THEN 1 ELSE 0 END)`, 'wins')
      .addSelect('COUNT(*)', 'n')
      .where(`p.outcome IN ('SUCCESS','FAILURE','EXPIRED')`)
      .groupBy('p.setup');
    if (beforeDate) qb.andWhere('p.date < :d', { d: beforeDate });
    const rows: { setup: string; wins: string; n: string }[] = await qb.getRawMany();
    const map = new Map<string, number | null>();
    for (const r of rows) {
      const n = Number(r.n);
      map.set(r.setup, n >= 30 ? Number(r.wins) / n : null);
    }
    return map;
  }

  /**
   * Run the pipeline for `date` (default: latest date with data, after trying to ingest today).
   */
  async run(date?: string, tryIngest = true): Promise<DailyRunResultDto> {
    const t0 = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    if (tryIngest) {
      const target = date ?? today;
      try {
        await this.data.ingestDate(target);
      } catch (err) {
        this.log.warn(`ingest ${target} failed: ${(err as Error).message}`);
      }
    }
    const runDate = date ?? (await this.store.latestDate());
    if (!runDate) throw new Error('No market data in the database. Run a backfill first.');

    const data = await this.store.load(runDate, runDate);
    const opts = this.defaultOptions();
    const [analysis] = await this.analysis.analyzeDates(data, [runDate], opts);
    if (!analysis) throw new Error(`Not enough data to analyse ${runDate} (need NIFTY history and ≥20 liquid stocks).`);
    const rates = await this.setupSuccessRates();
    const ranked = this.analysis.rank(analysis, opts, rates);
    const overview = this.analysis.toOverview(analysis);

    await this.snapshots.save({
      date: runDate,
      regime: overview.regime,
      volatilityRegime: overview.volatilityRegime,
      regimeScore: overview.regimeScore,
      longBias: overview.longBias,
      niftyClose: overview.nifty.close,
      vixClose: overview.vix?.close ?? null,
      overview,
      isBacktest: false,
    });

    await this.predictions.createQueryBuilder().delete().where('date = :d AND "runId" IS NULL', { d: runDate }).execute();
    const entities = ranked.map((r) => this.toEntity(r, runDate, overview.regime, null));
    const saved = entities.length ? await this.predictions.save(entities) : [];

    const evaluated = await this.evaluateOpen();
    const names = await this.nameMap(saved.map((p) => p.symbol));
    this.log.log(`Daily run ${runDate}: ${saved.length} picks, regime ${overview.regime}, ${evaluated} outcomes updated, ${Date.now() - t0}ms`);
    return {
      date: runDate,
      picks: saved.map((p) => toPickDto(p, names.get(p.symbol) ?? null)),
      overview,
      evaluated,
      durationMs: Date.now() - t0,
    };
  }

  toEntity(r: RankedPick, date: string, regime: string, runId: number | null): PredictionEntity {
    const c = r.candidate;
    return this.predictions.create({
      date,
      rank: r.rank,
      symbol: c.snap.symbol,
      sector: c.snap.sector,
      score: r.score,
      confidence: r.confidence,
      direction: 'LONG',
      setup: c.setup,
      setupSuccessRate: r.setupSuccessRate,
      regime,
      entry: c.levels.entry,
      entryLow: c.levels.entryLow,
      entryHigh: c.levels.entryHigh,
      target: c.levels.target,
      stopLoss: c.levels.stopLoss,
      riskReward: c.levels.riskReward,
      riskPct: c.levels.riskPct,
      rewardPct: c.levels.rewardPct,
      holdDays: c.levels.holdDays,
      reasons: r.reasons,
      factors: r.factors,
      outcome: 'OPEN',
      outcomeDate: null,
      fillPrice: null,
      exitPrice: null,
      grossReturnPct: null,
      netReturnPct: null,
      daysHeld: null,
      runId,
      createdAt: new Date().toISOString(),
    });
  }

  /** Re-check every OPEN live prediction against the bars that have arrived since. */
  async evaluateOpen(): Promise<number> {
    const open = await this.predictions.find({ where: { outcome: 'OPEN', runId: IsNull() } });
    if (!open.length) return 0;
    const earliest = open.reduce((m, p) => (p.date < m ? p.date : m), open[0].date);
    const latest = await this.store.latestDate();
    if (!latest) return 0;
    const symbols = [...new Set(open.map((p) => p.symbol))];
    const data = await this.store.load(earliest, latest, 5, symbols);
    let updated = 0;
    for (const p of open) {
      const s = data.symbols.get(p.symbol);
      if (!s) continue;
      const idx = s.dates.indexOf(p.date);
      if (idx < 0) continue;
      const res = evaluateOutcome(
        s,
        idx,
        {
          entry: p.entry,
          entryLow: p.entryLow,
          entryHigh: p.entryHigh,
          stopLoss: p.stopLoss,
          target: p.target,
          riskPct: p.riskPct,
          rewardPct: p.rewardPct,
          riskReward: p.riskReward,
          holdDays: p.holdDays,
        },
        DEFAULT_TRADING_COSTS,
      );
      if (res.outcome === 'OPEN') continue;
      Object.assign(p, {
        outcome: res.outcome,
        outcomeDate: res.outcomeDate,
        fillPrice: res.fillPrice,
        exitPrice: res.exitPrice,
        grossReturnPct: res.grossReturnPct,
        netReturnPct: res.netReturnPct,
        daysHeld: res.daysHeld,
      });
      await this.predictions.save(p);
      updated++;
    }
    return updated;
  }

  async nameMap(symbols: string[]): Promise<Map<string, string | null>> {
    if (!symbols.length) return new Map();
    const rows = await this.stocks.createQueryBuilder('s').select(['s.symbol', 's.name']).where('s.symbol IN (:...symbols)', { symbols }).getMany();
    return new Map(rows.map((r) => [r.symbol, r.name]));
  }

  /** Helper used by the scheduler: run for today, but only if bars are not already analysed. */
  async runScheduled(): Promise<void> {
    if (this.jobs.isRunning()) {
      this.log.warn('Skipping scheduled daily run: another job is running');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const job = this.jobs.start('DAILY_RUN', today, today, 1);
    try {
      const res = await this.run(undefined, true);
      this.jobs.progress(1, res.date);
      this.jobs.finish(`Daily run for ${res.date}: ${res.picks.length} picks`);
    } catch (err) {
      this.jobs.fail(err);
      this.log.error(`scheduled daily run failed: ${(err as Error).message}`);
    }
    void job;
    void shiftDate;
  }
}
