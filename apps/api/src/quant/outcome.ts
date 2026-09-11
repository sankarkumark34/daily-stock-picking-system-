import type { PredictionOutcome, TradingCostConfig } from '@nse/shared';
import { netReturnPct } from './costs.js';
import type { SymbolSeries, TradeLevels } from './types.js';

export interface OutcomeResult {
  outcome: PredictionOutcome;
  fillPrice: number | null;
  exitPrice: number | null;
  outcomeDate: string | null;
  grossReturnPct: number | null;
  netReturnPct: number | null;
  daysHeld: number | null;
}

/**
 * Objective prediction definition:
 *  - Fill at the next session's open (skip if it gaps > 2% above the entry).
 *  - Over the following `holdDays` sessions (fill day included):
 *      target touched first  → SUCCESS  (exit at target)
 *      stop touched first    → FAILURE  (exit at stop, or at the open if it gapped through)
 *      both in the same bar  → FAILURE  (conservative: assume the stop hit first)
 *      neither               → EXPIRED  (exit at close of the last session)
 *  - OPEN when not enough future bars exist yet.
 */
export function evaluateOutcome(
  s: SymbolSeries,
  signalIdx: number,
  levels: TradeLevels,
  costs: TradingCostConfig,
  maxGapPct = 2,
): OutcomeResult {
  const none: OutcomeResult = {
    outcome: 'OPEN',
    fillPrice: null,
    exitPrice: null,
    outcomeDate: null,
    grossReturnPct: null,
    netReturnPct: null,
    daysHeld: null,
  };
  const fillIdx = signalIdx + 1;
  if (fillIdx >= s.dates.length) return none;

  const fill = s.open[fillIdx];
  if (!Number.isFinite(fill) || fill <= 0) return none;
  if ((fill / levels.entry - 1) * 100 > maxGapPct) {
    return { ...none, outcome: 'NO_FILL', fillPrice: fill, outcomeDate: s.dates[fillIdx], daysHeld: 0 };
  }

  const done = (outcome: PredictionOutcome, exit: number, idx: number): OutcomeResult => {
    const gross = (exit / fill - 1) * 100;
    return {
      outcome,
      fillPrice: fill,
      exitPrice: exit,
      outcomeDate: s.dates[idx],
      grossReturnPct: Math.round(gross * 1000) / 1000,
      netReturnPct: Math.round(netReturnPct(fill, exit, costs) * 1000) / 1000,
      daysHeld: idx - fillIdx + 1,
    };
  };

  const lastIdx = fillIdx + levels.holdDays - 1;
  const breakeven = levels.breakevenTrigger;
  let activeStop = levels.stopLoss;
  let hasLockedBreakeven = false;

  for (let i = fillIdx; i <= lastIdx && i < s.dates.length; i++) {
    const hi = s.high[i];
    const lo = s.low[i];
    const op = s.open[i];

    // Breakeven Shield: When price reaches breakevenTrigger (+7%), raise stop to cover entry and fees
    if (breakeven && !hasLockedBreakeven && hi >= breakeven) {
      hasLockedBreakeven = true;
      activeStop = Math.max(activeStop, fill * 1.005);
    }

    if (i === fillIdx) {
      // On the fill day the open already happened at `fill`; a gap below stop exits immediately.
      if (op <= activeStop) return done(hasLockedBreakeven ? 'SUCCESS' : 'FAILURE', op, i);
    } else if (op <= activeStop) {
      return done(hasLockedBreakeven ? 'SUCCESS' : 'FAILURE', op, i);
    } else if (op >= levels.target) {
      return done('SUCCESS', op, i);
    }
    const hitStop = lo <= activeStop;
    const hitTarget = hi >= levels.target;
    if (hitStop) return done(hasLockedBreakeven ? 'SUCCESS' : 'FAILURE', activeStop, i);
    if (hitTarget) return done('SUCCESS', levels.target, i);
  }
  if (lastIdx < s.dates.length) return done('EXPIRED', s.close[lastIdx], lastIdx);
  return none;
}
