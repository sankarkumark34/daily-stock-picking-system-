import type { SetupType } from '@nse/shared';
import type { StockSnapshot, TradeLevels } from './types.js';

const round2 = (v: number) => Math.round(v * 100) / 100;

/** NSE tick size is ₹0.05 for most equities. */
const tick = (v: number) => round2(Math.round(v / 0.05) * 0.05);

interface SetupParams {
  stopAtr: number;
  targetAtr: number;
  holdDays: number;
  minTargetPct: number;
  maxRiskPct: number;
}

const PARAMS: Record<Exclude<SetupType, 'NONE'>, SetupParams> = {
  // 10 working days (2 weeks) short-term swing setups calibrated for >= 15% target potential
  VCP_BREAKOUT: { stopAtr: 1.4, targetAtr: 3.8, holdDays: 10, minTargetPct: 15.0, maxRiskPct: 5.5 },
  STAGE2_PULLBACK: { stopAtr: 1.3, targetAtr: 3.4, holdDays: 10, minTargetPct: 12.5, maxRiskPct: 4.8 },
  BREAKOUT: { stopAtr: 1.4, targetAtr: 3.8, holdDays: 10, minTargetPct: 15.0, maxRiskPct: 5.5 },
  PULLBACK: { stopAtr: 1.3, targetAtr: 3.2, holdDays: 10, minTargetPct: 12.0, maxRiskPct: 4.8 },
  TREND_CONTINUATION: { stopAtr: 1.4, targetAtr: 3.6, holdDays: 10, minTargetPct: 14.0, maxRiskPct: 5.2 },
  REVERSAL: { stopAtr: 1.2, targetAtr: 3.0, holdDays: 10, minTargetPct: 12.0, maxRiskPct: 4.5 },
};

/**
 * Entry = today's close (order placed for next open).
 * Stop  = tighter of structural swing low (below 21-EMA) and ATR stop, capped at maxRiskPct.
 * Target= close + m·ATR (or minTargetPct to deliver user's 15% / 30% goal).
 * Risk/reward must land >= 2.0:1.
 */
export function computeLevels(s: StockSnapshot, setup: SetupType, holdDaysOverride?: number): TradeLevels | null {
  if (setup === 'NONE') return null;
  const p = PARAMS[setup];
  const atr = s.atr14;
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const entry = s.close;

  const isLongTerm = (holdDaysOverride ?? p.holdDays) >= 25;
  const targetPct = isLongTerm ? 30.0 : Math.max(p.minTargetPct, (p.targetAtr * atr / entry) * 100);

  // Structural stop: below recent low or 21-EMA buffer
  const structuralStop = Math.min(s.low, s.ema21 * 0.985) - 0.25 * atr;
  const atrStop = entry - (isLongTerm ? 2.0 : p.stopAtr) * atr;
  let stop = Math.max(structuralStop, atrStop);

  let riskPct = ((entry - stop) / entry) * 100;
  const maxRisk = isLongTerm ? 7.5 : p.maxRiskPct;
  if (riskPct < 2.0) {
    stop = entry * (1 - 0.02);
    riskPct = 2.0;
  } else if (riskPct > maxRisk) {
    stop = entry * (1 - maxRisk / 100);
    riskPct = maxRisk;
  }

  const target = entry * (1 + targetPct / 100);
  const rewardPct = ((target - entry) / entry) * 100;
  const rr = rewardPct / riskPct;
  if (rr < 1.8) return null;

  return {
    entry: round2(entry),
    entryLow: tick(entry * 0.995),
    entryHigh: tick(entry * 1.008),
    stopLoss: tick(stop),
    target: tick(target),
    breakevenTrigger: tick(entry * 1.07), // At +7% gain, move stop to entry (Breakeven Shield)
    target2: tick(target * 1.08), // Runner target
    riskPct: round2(riskPct),
    rewardPct: round2(rewardPct),
    riskReward: round2(rr),
    holdDays: holdDaysOverride ?? p.holdDays,
    horizon: isLongTerm ? 'LONG_TERM' : 'SHORT_TERM',
  };
}
