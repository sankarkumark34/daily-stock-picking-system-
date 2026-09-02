import { describe, expect, it } from 'vitest';
import { adx, atr, bollinger, ema, priorRollingMax, rsi, sma, stochRsi, supertrend } from './indicators.js';

const F = (a: number[]) => Float64Array.from(a);

describe('indicators', () => {
  it('sma matches a hand calculation and is NaN before the window fills', () => {
    const out = sma(F([1, 2, 3, 4, 5, 6]), 3);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[2]).toBeCloseTo(2);
    expect(out[5]).toBeCloseTo(5);
  });

  it('sma tolerates a NaN prefix instead of poisoning the running sum', () => {
    const out = sma(F([NaN, NaN, 1, 2, 3, 4]), 3);
    expect(Number.isNaN(out[3])).toBe(true); // window still contains a NaN
    expect(out[4]).toBeCloseTo(2);
    expect(out[5]).toBeCloseTo(3);
  });

  it('stochRsi is defined once RSI has warmed up', () => {
    const close = F(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1));
    const out = stochRsi(rsi(close, 14), 14, 3);
    const v = out[79];
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it('ema seeds with the SMA and then follows the recursive formula', () => {
    const out = ema(F([10, 10, 10, 10, 20]), 4);
    expect(out[3]).toBeCloseTo(10);
    // k = 2/5 = 0.4 → 20*0.4 + 10*0.6 = 14
    expect(out[4]).toBeCloseTo(14);
  });

  it('rsi is 100 for a monotonic rise and ~0 for a monotonic fall', () => {
    const up = rsi(F(Array.from({ length: 30 }, (_, i) => 100 + i)), 14);
    const down = rsi(F(Array.from({ length: 30 }, (_, i) => 200 - i)), 14);
    expect(up[29]).toBeCloseTo(100);
    expect(down[29]).toBeCloseTo(0);
  });

  it('atr equals the constant range when bars do not gap', () => {
    const n = 40;
    const high = F(Array.from({ length: n }, () => 105));
    const low = F(Array.from({ length: n }, () => 95));
    const close = F(Array.from({ length: n }, () => 100));
    const out = atr(high, low, close, 14);
    expect(out[n - 1]).toBeCloseTo(10);
  });

  it('bollinger %B sits at 0.5 for a flat series and widens with volatility', () => {
    const flat = bollinger(F(Array.from({ length: 25 }, () => 50)), 20, 2);
    expect(flat.pctB[24]).toBeCloseTo(0.5);
    const noisy = bollinger(F(Array.from({ length: 25 }, (_, i) => 50 + (i % 2 ? 5 : -5))), 20, 2);
    expect(noisy.width[24]).toBeGreaterThan(0);
  });

  it('priorRollingMax excludes the current bar (breakout detection)', () => {
    const out = priorRollingMax(F([1, 2, 3, 10, 4]), 3);
    expect(out[3]).toBe(3); // max of bars 0..2
    expect(out[4]).toBe(10);
  });

  it('adx is bounded 0-100 and defined after warm-up', () => {
    const n = 80;
    const close = F(Array.from({ length: n }, (_, i) => 100 + i * 0.8 + Math.sin(i) * 2));
    const high = F(Array.from(close, (c) => c + 1.5));
    const low = F(Array.from(close, (c) => c - 1.5));
    const out = adx(high, low, close, 14).adx;
    const v = out[n - 1];
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it('supertrend flips bullish in a steady uptrend', () => {
    const n = 60;
    const close = F(Array.from({ length: n }, (_, i) => 100 + i));
    const high = F(Array.from(close, (c) => c + 1));
    const low = F(Array.from(close, (c) => c - 1));
    const st = supertrend(high, low, close, 10, 3);
    expect(st.dir[n - 1]).toBe(1);
  });
});
