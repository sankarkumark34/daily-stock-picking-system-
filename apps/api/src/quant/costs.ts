import type { TradingCostConfig } from '@nse/shared';

/**
 * Indian equity delivery cost model, expressed as % of notional per side.
 * STT applies on both legs for delivery; stamp duty on the buy leg only;
 * GST on brokerage + exchange charges.
 */
export function buySideCostPct(c: TradingCostConfig): number {
  const gst = ((c.brokeragePct + c.exchangePct) * c.gstPct) / 100;
  return c.brokeragePct + c.sttPct + c.exchangePct + c.sebiPct + c.stampDutyPct + gst + c.slippagePct;
}

export function sellSideCostPct(c: TradingCostConfig): number {
  const gst = ((c.brokeragePct + c.exchangePct) * c.gstPct) / 100;
  return c.brokeragePct + c.sttPct + c.exchangePct + c.sebiPct + gst + c.slippagePct;
}

export function roundTripCostPct(c: TradingCostConfig): number {
  return buySideCostPct(c) + sellSideCostPct(c);
}

/** Net % return after buying at `entry` and selling at `exit` with all costs applied. */
export function netReturnPct(entry: number, exit: number, c: TradingCostConfig): number {
  const effectiveEntry = entry * (1 + buySideCostPct(c) / 100);
  const effectiveExit = exit * (1 - sellSideCostPct(c) / 100);
  return (effectiveExit / effectiveEntry - 1) * 100;
}
