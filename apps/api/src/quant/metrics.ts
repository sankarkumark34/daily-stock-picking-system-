import type { BacktestMetrics, DailyHitRatePoint, EquityPoint, GroupStatsDto, MarketRegime, RollingHitRatePoint } from '@nse/shared';
import type { TradeRecord } from './types.js';

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const std = (a: number[]) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / (a.length - 1));
};
const nz = (v: number): number | null => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

const isClosed = (t: TradeRecord) => t.outcome === 'SUCCESS' || t.outcome === 'FAILURE' || t.outcome === 'EXPIRED';

export function groupStats(trades: TradeRecord[], keyFn: (t: TradeRecord) => string): GroupStatsDto[] {
  const groups = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    if (!isClosed(t)) continue;
    const k = keyFn(t);
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }
  const out: GroupStatsDto[] = [];
  for (const [key, list] of groups) {
    const rets = list.map((t) => t.netReturnPct ?? 0);
    const wins = rets.filter((r) => r > 0);
    const losses = rets.filter((r) => r <= 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    out.push({
      key,
      trades: list.length,
      hitRate: nz((list.filter((t) => t.outcome === 'SUCCESS').length / list.length) * 100),
      directionalAccuracy: nz((wins.length / list.length) * 100),
      avgNetReturnPct: nz(mean(rets)),
      expectancyPct: nz(mean(rets)),
      profitFactor: grossLoss === 0 ? (grossWin > 0 ? 99 : null) : nz(grossWin / grossLoss),
    });
  }
  return out.sort((a, b) => b.trades - a.trades);
}

export function dailySeries(trades: TradeRecord[], regimeByDate?: Map<string, string>): DailyHitRatePoint[] {
  const byDate = new Map<string, TradeRecord[]>();
  for (const t of trades) {
    const g = byDate.get(t.date);
    if (g) g.push(t);
    else byDate.set(t.date, [t]);
  }
  const out: DailyHitRatePoint[] = [];
  for (const [date, list] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const closed = list.filter(isClosed);
    const success = closed.filter((t) => t.outcome === 'SUCCESS').length;
    const failure = closed.filter((t) => t.outcome === 'FAILURE').length;
    const expired = closed.filter((t) => t.outcome === 'EXPIRED').length;
    out.push({
      date,
      picks: list.length,
      success,
      failure,
      expired,
      hitRate: closed.length ? nz((success / closed.length) * 100) : null,
      avgNetReturnPct: closed.length ? nz(mean(closed.map((t) => t.netReturnPct ?? 0))) : null,
      regime: (regimeByDate?.get(date) as MarketRegime | undefined) ?? (list[0]?.regime as MarketRegime) ?? null,
    });
  }
  return out;
}

/**
 * Equity curve: start at 100, each filled trade risks 1/maxPicks of the *initial*
 * capital (fixed fractional sizing keeps returns additive and comparable).
 */
export function equityCurve(trades: TradeRecord[], tradingDates: string[], maxPicks: number): EquityPoint[] {
  const pnlByDate = new Map<string, number>();
  for (const t of trades) {
    if (!isClosed(t) || !t.outcomeDate || t.netReturnPct === null) continue;
    pnlByDate.set(t.outcomeDate, (pnlByDate.get(t.outcomeDate) ?? 0) + t.netReturnPct / maxPicks);
  }
  const out: EquityPoint[] = [];
  let eq = 100;
  let peak = 100;
  for (const d of tradingDates) {
    eq += pnlByDate.get(d) ?? 0;
    if (eq > peak) peak = eq;
    out.push({ date: d, equity: Math.round(eq * 100) / 100, drawdownPct: Math.round(((eq / peak - 1) * 100) * 100) / 100 });
  }
  return out;
}

export function rollingHitRates(daily: DailyHitRatePoint[]): RollingHitRatePoint[] {
  const out: RollingHitRatePoint[] = [];
  const windows = [30, 90, 180, 365];
  for (let i = 0; i < daily.length; i++) {
    const d = daily[i].date;
    const point: RollingHitRatePoint = { date: d, hitRate30: null, hitRate90: null, hitRate180: null, hitRate365: null };
    for (const w of windows) {
      const from = shiftDate(d, -w);
      let s = 0;
      let n = 0;
      for (let j = i; j >= 0 && daily[j].date >= from; j--) {
        s += daily[j].success;
        n += daily[j].success + daily[j].failure + daily[j].expired;
      }
      const v = n >= 10 ? Math.round((s / n) * 1000) / 10 : null;
      if (w === 30) point.hitRate30 = v;
      else if (w === 90) point.hitRate90 = v;
      else if (w === 180) point.hitRate180 = v;
      else point.hitRate365 = v;
    }
    out.push(point);
  }
  return out;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeMetrics(trades: TradeRecord[], tradingDates: string[], maxPicks: number, roundTripCost: number): BacktestMetrics {
  const filled = trades.filter((t) => t.outcome !== 'NO_FILL');
  const closed = trades.filter(isClosed);
  const rets = closed.map((t) => t.netReturnPct ?? 0);
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const success = closed.filter((t) => t.outcome === 'SUCCESS').length;
  const failure = closed.filter((t) => t.outcome === 'FAILURE').length;
  const expired = closed.filter((t) => t.outcome === 'EXPIRED').length;

  const eq = equityCurve(trades, tradingDates, maxPicks);
  const dailyRets: number[] = [];
  for (let i = 1; i < eq.length; i++) dailyRets.push(eq[i].equity / eq[i - 1].equity - 1);
  const dr = dailyRets.filter(Number.isFinite);
  const sharpe = dr.length > 20 && std(dr) > 0 ? (mean(dr) / std(dr)) * Math.sqrt(252) : NaN;
  const downside = dr.filter((r) => r < 0);
  const dd = downside.length ? Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / dr.length) : NaN;
  const sortino = dr.length > 20 && dd > 0 ? (mean(dr) / dd) * Math.sqrt(252) : NaN;
  const maxDD = eq.length ? Math.min(...eq.map((p) => p.drawdownPct)) : NaN;
  const years = tradingDates.length / 252;
  const finalEq = eq.length ? eq[eq.length - 1].equity : 100;
  const cagr = years > 0.25 && finalEq > 0 ? (Math.pow(finalEq / 100, 1 / years) - 1) * 100 : NaN;

  const daily = dailySeries(closed);
  const selectionDays = new Set(trades.map((t) => t.date)).size;
  const dailyHit = daily.filter((d) => d.hitRate !== null).map((d) => d.hitRate as number);
  const days6of10 = daily.filter((d) => d.picks >= 8 && d.success >= 6).length;

  return {
    trades: trades.length,
    filled: filled.length,
    noFill: trades.length - filled.length,
    success,
    failure,
    expired,
    winRate: nz(closed.length ? (success / closed.length) * 100 : NaN),
    lossRate: nz(closed.length ? (failure / closed.length) * 100 : NaN),
    targetHitRate: nz(closed.length ? (success / closed.length) * 100 : NaN),
    stopHitRate: nz(closed.length ? (failure / closed.length) * 100 : NaN),
    expiredRate: nz(closed.length ? (expired / closed.length) * 100 : NaN),
    directionalAccuracy: nz(closed.length ? (wins.length / closed.length) * 100 : NaN),
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? 99 : null) : nz(grossWin / grossLoss),
    expectancyPct: nz(mean(rets)),
    avgWinPct: nz(mean(wins)),
    avgLossPct: nz(mean(losses)),
    avgNetReturnPct: nz(mean(rets)),
    medianNetReturnPct: nz(median(rets)),
    totalNetReturnPct: nz(finalEq - 100),
    maxDrawdownPct: nz(maxDD),
    sharpe: nz(sharpe),
    sortino: nz(sortino),
    cagrPct: nz(cagr),
    avgHoldingDays: nz(mean(closed.map((t) => t.daysHeld ?? 0))),
    tradingDays: tradingDates.length,
    daysWithPicks: selectionDays,
    avgPicksPerDay: nz(selectionDays ? trades.length / selectionDays : NaN),
    avgDailyHitRate: nz(mean(dailyHit)),
    medianDailyHitRate: nz(median(dailyHit)),
    daysWith6PlusOf10: days6of10,
    totalCostPct: nz(roundTripCost),
  };
}

/** Honest one-paragraph verdict from the numbers. */
export function verdictFor(m: BacktestMetrics, oos: BacktestMetrics | null): string {
  if (m.trades < 50) return 'Too few trades to draw any statistical conclusion. Extend the date range or loosen the quality threshold before judging the model.';
  const parts: string[] = [];
  const wr = m.winRate ?? 0;
  const exp = m.expectancyPct ?? 0;
  const pf = m.profitFactor ?? 0;
  parts.push(`Across ${m.trades} picks the target was hit first ${wr.toFixed(1)}% of the time, the stop ${(m.stopHitRate ?? 0).toFixed(1)}%, and ${(m.expiredRate ?? 0).toFixed(1)}% expired.`);
  parts.push(`Net of costs the average pick returned ${exp >= 0 ? '+' : ''}${exp.toFixed(2)}% (profit factor ${pf.toFixed(2)}, max drawdown ${(m.maxDrawdownPct ?? 0).toFixed(1)}%).`);
  if (m.avgDailyHitRate !== null) {
    parts.push(`On an average day ${m.avgDailyHitRate.toFixed(0)}% of the selected stocks hit target; ${m.daysWith6PlusOf10} days had 6+ winners out of a full 8-10 pick list.`);
  }
  if (exp <= 0 || pf < 1) parts.push('Verdict: the strategy does NOT show a positive edge after costs in this period.');
  else if (pf < 1.2 || exp < 0.3) parts.push('Verdict: marginal edge — positive but thin; likely not robust to slippage or regime change.');
  else parts.push('Verdict: a positive, repeatable edge is present in-sample. Confirm it out-of-sample before trusting it.');
  if (oos) {
    const oe = oos.expectancyPct ?? 0;
    parts.push(
      oos.trades < 30
        ? 'Out-of-sample window has too few trades to confirm.'
        : oe > 0 && (oos.profitFactor ?? 0) >= 1.1
          ? `Out-of-sample expectancy ${oe >= 0 ? '+' : ''}${oe.toFixed(2)}% confirms the edge held on unseen data.`
          : `Out-of-sample expectancy ${oe.toFixed(2)}% — the edge did not hold on unseen data (possible overfit).`,
    );
  }
  parts.push('The 6–7 out of 10 target is ' + ((m.avgDailyHitRate ?? 0) >= 60 ? 'being met on average.' : 'NOT being met on average.'));
  return parts.join(' ');
}
