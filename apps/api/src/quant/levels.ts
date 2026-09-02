import type { SetupType } from '@nse/shared';
import type { StockSnapshot, TradeLevels } from './types.js';

const round2 = (v: number) => Math.round(v * 100) / 100;

/** NSE tick size is ₹0.05 for most equities. */
const tick = (v: number) => round2(Math.round(v / 0.05) * 0.05);

interface SetupParams {
  stopAtr: number;
  targetAtr: number;
  holdDays: number;
}

const PARAMS: Record<Exclude<SetupType, 'NONE'>, SetupParams> = {
  // target ≈ expected absolute move over the hold (ATR·√days ≈ 2.2 ATR for 5 sessions); stop ≈ 1.25 ATR
  BREAKOUT: { stopAtr: 1.25, targetAtr: 2.0, holdDays: 5 },
  TREND_CONTINUATION: { stopAtr: 1.3, targetAtr: 2.2, holdDays: 7 },
  PULLBACK: { stopAtr: 1.1, targetAtr: 1.8, holdDays: 5 },
  REVERSAL: { stopAtr: 1.1, targetAtr: 1.8, holdDays: 5 },
};

/**
 * Entry = today's close (the order is assumed to be placed for next open).
 * Stop  = tighter of (close − k·ATR) and the recent swing low minus a buffer.
 * Target= close + m·ATR. Risk must land between 1.5% and 8% or the idea is skipped.
 */
export function computeLevels(s: StockSnapshot, setup: SetupType, holdDaysOverride?: number): TradeLevels | null {
  if (setup === 'NONE') return null;
  const p = PARAMS[setup];
  const atr = s.atr14;
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const entry = s.close;

  // swing low: lowest low of the last 5 bars is unknown here (snapshot), use today's low & priorLow proxies
  const structuralStop = Math.min(s.low, s.ema21 * 0.985) - 0.25 * atr;
  const atrStop = entry - p.stopAtr * atr;
  let stop = Math.max(structuralStop, atrStop); // the tighter (higher) of the two
  let riskPct = ((entry - stop) / entry) * 100;
  if (riskPct < 1.5) {
    stop = entry * (1 - 0.015);
    riskPct = 1.5;
  }
  if (riskPct > 8) return null;

  const target = entry + p.targetAtr * atr;
  const rewardPct = ((target - entry) / entry) * 100;
  const rr = rewardPct / riskPct;
  if (rr < 1.1) return null;

  return {
    entry: round2(entry),
    entryLow: tick(entry * 0.997),
    entryHigh: tick(entry * 1.005),
    stopLoss: tick(stop),
    target: tick(target),
    riskPct: round2(riskPct),
    rewardPct: round2(rewardPct),
    riskReward: round2(rr),
    holdDays: holdDaysOverride ?? p.holdDays,
  };
}
