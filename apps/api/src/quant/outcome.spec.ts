import { DEFAULT_TRADING_COSTS } from '@nse/shared';
import { describe, expect, it } from 'vitest';
import { netReturnPct, roundTripCostPct } from './costs.js';
import { computeMetrics } from './metrics.js';
import { evaluateOutcome } from './outcome.js';
import type { SymbolSeries, TradeLevels, TradeRecord } from './types.js';

function series(rows: [string, number, number, number, number][]): SymbolSeries {
  const n = rows.length;
  const s: SymbolSeries = {
    symbol: 'TEST',
    name: null,
    sector: 'Test',
    dates: rows.map((r) => r[0]),
    open: new Float64Array(n),
    high: new Float64Array(n),
    low: new Float64Array(n),
    close: new Float64Array(n),
    volume: new Float64Array(n).fill(1000),
    turnover: new Float64Array(n).fill(1e8),
    deliveryPct: new Float64Array(n).fill(NaN),
  };
  rows.forEach((r, i) => {
    s.open[i] = r[1];
    s.high[i] = r[2];
    s.low[i] = r[3];
    s.close[i] = r[4];
  });
  return s;
}

const levels: TradeLevels = { entry: 100, entryLow: 99.7, entryHigh: 100.5, stopLoss: 95, target: 110, riskPct: 5, rewardPct: 10, riskReward: 2, holdDays: 5 };

describe('evaluateOutcome (prediction definition)', () => {
  it('is OPEN when no future bar exists yet', () => {
    const s = series([['2025-01-01', 100, 101, 99, 100]]);
    expect(evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS).outcome).toBe('OPEN');
  });

  it('marks SUCCESS when the target is touched first and exits at the target', () => {
    const s = series([
      ['2025-01-01', 100, 101, 99, 100],
      ['2025-01-02', 100.5, 103, 99.5, 102],
      ['2025-01-03', 102, 111, 101, 109],
    ]);
    const r = evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS);
    expect(r.outcome).toBe('SUCCESS');
    expect(r.fillPrice).toBe(100.5);
    expect(r.exitPrice).toBe(110);
    expect(r.outcomeDate).toBe('2025-01-03');
    expect(r.daysHeld).toBe(2);
    expect(r.grossReturnPct).toBeCloseTo((110 / 100.5 - 1) * 100, 3);
    expect(r.netReturnPct!).toBeLessThan(r.grossReturnPct!);
  });

  it('marks FAILURE when the stop is touched first', () => {
    const s = series([
      ['2025-01-01', 100, 101, 99, 100],
      ['2025-01-02', 100, 101, 94, 96],
    ]);
    const r = evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS);
    expect(r.outcome).toBe('FAILURE');
    expect(r.exitPrice).toBe(95);
  });

  it('treats a bar that touches both target and stop as FAILURE (conservative)', () => {
    const s = series([
      ['2025-01-01', 100, 101, 99, 100],
      ['2025-01-02', 100, 112, 94, 100],
    ]);
    expect(evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS).outcome).toBe('FAILURE');
  });

  it('exits at the open when price gaps through the stop', () => {
    const s = series([
      ['2025-01-01', 100, 101, 99, 100],
      ['2025-01-02', 100, 101, 99, 100],
      ['2025-01-03', 90, 92, 88, 91],
    ]);
    const r = evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS);
    expect(r.outcome).toBe('FAILURE');
    expect(r.exitPrice).toBe(90);
  });

  it('EXPIRES at the last close when neither level is touched within holdDays', () => {
    const rows: [string, number, number, number, number][] = [['2025-01-01', 100, 101, 99, 100]];
    for (let i = 2; i <= 7; i++) rows.push([`2025-01-0${i}`, 100, 102, 98, 101]);
    const r = evaluateOutcome(s(rows), 0, levels, DEFAULT_TRADING_COSTS);
    expect(r.outcome).toBe('EXPIRED');
    expect(r.exitPrice).toBe(101);
    expect(r.daysHeld).toBe(5);
    function s(x: typeof rows) {
      return series(x);
    }
  });

  it('does not fill when the next open gaps more than 2% above the entry', () => {
    const s = series([
      ['2025-01-01', 100, 101, 99, 100],
      ['2025-01-02', 103, 112, 102, 111],
    ]);
    expect(evaluateOutcome(s, 0, levels, DEFAULT_TRADING_COSTS).outcome).toBe('NO_FILL');
  });
});

describe('costs', () => {
  it('round trip is roughly 0.4% with defaults and net return is below gross', () => {
    const rt = roundTripCostPct(DEFAULT_TRADING_COSTS);
    expect(rt).toBeGreaterThan(0.3);
    expect(rt).toBeLessThan(0.6);
    expect(netReturnPct(100, 100, DEFAULT_TRADING_COSTS)).toBeCloseTo(-rt, 1);
  });
});

describe('metrics', () => {
  it('computes win rate, profit factor and expectancy', () => {
    const trades: TradeRecord[] = [
      { date: '2025-01-01', symbol: 'A', sector: 'X', setup: 'BREAKOUT', regime: 'BULLISH', outcome: 'SUCCESS', grossReturnPct: 10, netReturnPct: 9.6, outcomeDate: '2025-01-03', daysHeld: 2 },
      { date: '2025-01-01', symbol: 'B', sector: 'X', setup: 'BREAKOUT', regime: 'BULLISH', outcome: 'FAILURE', grossReturnPct: -5, netReturnPct: -5.4, outcomeDate: '2025-01-02', daysHeld: 1 },
      { date: '2025-01-02', symbol: 'C', sector: 'Y', setup: 'PULLBACK', regime: 'BULLISH', outcome: 'EXPIRED', grossReturnPct: 1, netReturnPct: 0.6, outcomeDate: '2025-01-08', daysHeld: 5 },
      { date: '2025-01-02', symbol: 'D', sector: 'Y', setup: 'PULLBACK', regime: 'BULLISH', outcome: 'NO_FILL', grossReturnPct: null, netReturnPct: null, outcomeDate: '2025-01-03', daysHeld: 0 },
    ];
    const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-08'];
    const m = computeMetrics(trades, dates, 10, 0.4);
    expect(m.trades).toBe(4);
    expect(m.filled).toBe(3);
    expect(m.winRate).toBeCloseTo(33.333, 2);
    expect(m.profitFactor).toBeCloseTo((9.6 + 0.6) / 5.4, 2);
    expect(m.expectancyPct).toBeCloseTo((9.6 - 5.4 + 0.6) / 3, 2);
    expect(m.directionalAccuracy).toBeCloseTo(66.667, 2);
  });
});
