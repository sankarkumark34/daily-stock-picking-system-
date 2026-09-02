/**
 * Operator CLI — runs the same services as the API without starting HTTP.
 *
 *   npm run cli -- universe
 *   npm run cli -- ingest 2025-08-29
 *   npm run cli -- backfill 2019-01-01 2025-08-29
 *   npm run cli -- run [2025-08-29]
 *   npm run cli -- evaluate
 *   npm run cli -- backtest 2019-01-01 2025-08-29 [--no-wf] [--opt] [--label "name"]
 */
process.env.SCHEDULER_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DataService } from './data/data.service.js';
import { DailyRunService } from './engine/daily-run.service.js';
import { JobsService } from './engine/jobs.service.js';
import { BacktestService } from './backtest/backtest.service.js';
import { BacktestRunEntity } from './database/entities/backtest-run.entity.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const data = app.get(DataService);
  const daily = app.get(DailyRunService);
  const jobs = app.get(JobsService);
  const backtest = app.get(BacktestService);
  const flag = (name: string) => args.includes(name);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--label'));

  try {
    switch (cmd) {
      case 'universe': {
        const n = await data.syncUniverse();
        console.log(`Mapped ${n} Nifty 500 constituents to sectors.`);
        break;
      }
      case 'ingest': {
        const date = positional[0];
        if (!date) throw new Error('usage: ingest YYYY-MM-DD');
        const rows = await data.ingestDate(date, flag('--force'));
        console.log(`${date}: ${rows} equity rows stored.`);
        break;
      }
      case 'backfill': {
        const [from, to] = positional;
        if (!from || !to) throw new Error('usage: backfill FROM TO');
        data.startBackfill(from, to, flag('--force'));
        let last = '';
        while (jobs.isRunning()) {
          const j = jobs.get()!;
          const line = `${j.processed}/${j.total} ${j.currentDate ?? ''} ${j.message ?? ''}`;
          if (line !== last) {
            process.stdout.write(`\r${line.padEnd(90)}`);
            last = line;
          }
          await sleep(500);
        }
        console.log(`\n${jobs.get()?.message}`);
        break;
      }
      case 'run': {
        const res = await daily.run(positional[0], !flag('--no-ingest'));
        console.log(`\n${res.date}  regime=${res.overview.regime}  NIFTY ${res.overview.nifty.close} (${res.overview.nifty.changePct}%)  VIX ${res.overview.vix?.close ?? '-'}`);
        console.log(`Top sectors: ${res.overview.sectors.slice(0, 3).map((s) => `${s.sector} (${s.score.toFixed(0)})`).join(', ')}`);
        console.table(
          res.picks.map((p) => ({
            rank: p.rank,
            symbol: p.symbol,
            score: p.score,
            conf: p.confidence,
            setup: p.setup,
            entry: p.entry,
            target: p.target,
            sl: p.stopLoss,
            rr: p.riskReward,
            hold: p.holdDays,
            sector: p.sector,
          })),
        );
        console.log(`${res.evaluated} earlier predictions resolved. ${res.durationMs}ms`);
        break;
      }
      case 'evaluate': {
        const n = await daily.evaluateOpen();
        console.log(`${n} predictions updated.`);
        break;
      }
      case 'backtest': {
        const [from, to] = positional;
        if (!from || !to) throw new Error('usage: backtest FROM TO [--no-wf] [--opt] [--label name]');
        const run = await backtest.start({ fromDate: from, toDate: to, walkForward: !flag('--no-wf'), optimizeWeights: flag('--opt'), label: opt('--label') });
        const repo = app.get<Repository<BacktestRunEntity>>(getRepositoryToken(BacktestRunEntity));
        let status = 'RUNNING';
        while (status === 'RUNNING' || status === 'QUEUED') {
          await sleep(1500);
          const r = await repo.findOne({ where: { id: run.id }, select: { status: true, progress: true } });
          status = r?.status ?? 'FAILED';
          process.stdout.write(`\rbacktest #${run.id} ${status} ${r?.progress ?? 0}%   `);
        }
        const res = await backtest.get(run.id);
        console.log('\n');
        if (res.error) console.error(res.error);
        if (res.metrics) {
          const m = res.metrics;
          console.table({
            trades: m.trades,
            winRate: m.winRate,
            stopHitRate: m.stopHitRate,
            expiredRate: m.expiredRate,
            directionalAccuracy: m.directionalAccuracy,
            expectancyPct: m.expectancyPct,
            profitFactor: m.profitFactor,
            avgWinPct: m.avgWinPct,
            avgLossPct: m.avgLossPct,
            maxDrawdownPct: m.maxDrawdownPct,
            sharpe: m.sharpe,
            sortino: m.sortino,
            cagrPct: m.cagrPct,
            avgDailyHitRate: m.avgDailyHitRate,
            daysWith6PlusOf10: m.daysWith6PlusOf10,
          });
          console.log('By regime:');
          console.table(res.byRegime);
          console.log('By setup:');
          console.table(res.bySetup);
          if (res.walkForward.length) {
            console.log('Walk-forward (test windows):');
            console.table(
              res.walkForward.map((w) => ({
                split: w.label,
                testTrades: w.test.metrics?.trades ?? 0,
                testWinRate: w.test.metrics?.winRate ?? null,
                testExpectancy: w.test.metrics?.expectancyPct ?? null,
                testPF: w.test.metrics?.profitFactor ?? null,
              })),
            );
          }
          console.log(`\nVERDICT: ${res.verdict}`);
        }
        break;
      }
      default:
        console.log('commands: universe | ingest DATE | backfill FROM TO | run [DATE] | evaluate | backtest FROM TO [--no-wf] [--opt] [--label name]');
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
