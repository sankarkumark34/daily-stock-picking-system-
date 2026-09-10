import type { SetupType } from '@nse/shared';
import type { StockSnapshot } from './types.js';

export interface SetupDetection {
  setup: SetupType;
  evidence: string[];
}

const pct = (a: number, b: number) => (a / b - 1) * 100;

/**
 * Rule-based setup detection. Order of precedence when several match:
 * BREAKOUT > PULLBACK > TREND_CONTINUATION > REVERSAL.
 * Only long setups are generated; the system does not short.
 */
export function detectSetup(s: StockSnapshot): SetupDetection {
  const uptrend = s.ema21 > s.ema50 && s.ema50 > s.sma200;
  const range = s.high - s.low;
  const closePos = range > 0 ? (s.close - s.low) / range : 0.5;
  const distEma21 = pct(s.close, s.ema21);

  // --- VCP Breakout: Volatility contraction squeeze followed by volume explosion
  const isVcpTight = (Number.isFinite(s.bbWidth) && s.bbWidth <= 12.5) || (Number.isFinite(s.atrPct) && s.atrPct <= 3.2);
  const near52wHigh = Number.isFinite(s.high252) ? s.close >= s.high252 * 0.88 : true;
  if (
    uptrend &&
    isVcpTight &&
    Number.isFinite(s.priorHigh20) &&
    s.close > s.priorHigh20 &&
    s.relVol >= 1.8 &&
    closePos >= 0.65 &&
    s.close > s.open &&
    near52wHigh
  ) {
    return {
      setup: 'VCP_BREAKOUT',
      evidence: [
        `VCP Volatility contraction breakout: Bandwidth ${s.bbWidth.toFixed(1)}% with ${s.relVol.toFixed(1)}× volume explosion`,
        `Closed in top ${Math.round((1 - closePos) * 100)}% of range, breaking prior 20-day high (₹${s.priorHigh20.toFixed(1)})`,
        `Stage-2 uptrend near 52-week highs — high probability sprint momentum setup`,
      ],
    };
  }

  // --- Stage-2 Pullback: Healthy dip to 21-EMA with clean bounce candle in established trend
  if (
    uptrend &&
    distEma21 >= -2.5 &&
    distEma21 <= 2.0 &&
    s.close > s.open &&
    s.close > s.ema21 &&
    s.low <= s.ema21 * 1.015 &&
    s.low > s.ema50 * 0.985 &&
    s.rsi14 >= 40 &&
    s.rsi14 <= 62 &&
    s.relVol >= 1.0
  ) {
    return {
      setup: 'STAGE2_PULLBACK',
      evidence: [
        `Stage-2 pullback to 21-EMA (${distEma21 >= 0 ? '+' : ''}${distEma21.toFixed(1)}%) with strong bullish bounce candle`,
        `Healthy momentum reset: RSI ${s.rsi14.toFixed(0)}, ADX ${s.adx14.toFixed(0)} — trend intact`,
        `Asymmetric risk-reward entry: buying support with tight structural stop`,
      ],
    };
  }

  // --- Breakout: closes above the prior 20-day high on expanding volume
  if (
    Number.isFinite(s.priorHigh20) &&
    s.close > s.priorHigh20 &&
    s.relVol >= 1.5 &&
    closePos >= 0.6 &&
    s.close > s.ema21 &&
    s.close > s.sma50
  ) {
    return {
      setup: 'BREAKOUT',
      evidence: [
        `Closed ${pct(s.close, s.priorHigh20).toFixed(1)}% above the prior 20-day high (₹${s.priorHigh20.toFixed(1)})`,
        `Volume ${s.relVol.toFixed(1)}× its 20-day average`,
        `Finished in the top ${Math.round((1 - closePos) * 100)}% of the day's range`,
      ],
    };
  }

  // --- Pullback: established uptrend, price returned to EMA21 and is turning up
  if (
    uptrend &&
    s.adx14 >= 20 &&
    s.maxDistEma21_10 >= 4 &&
    distEma21 >= -2.5 &&
    distEma21 <= 2.5 &&
    s.low > s.ema50 * 0.985 &&
    s.close > s.open &&
    s.rsi14 >= 40 &&
    s.rsi14 <= 65
  ) {
    return {
      setup: 'PULLBACK',
      evidence: [
        `Uptrend intact (EMA21 > EMA50 > SMA200, ADX ${s.adx14.toFixed(0)})`,
        `Pulled back to the 21-EMA (${distEma21 >= 0 ? '+' : ''}${distEma21.toFixed(1)}%) after trading ${s.maxDistEma21_10.toFixed(1)}% above it`,
        `Bullish close with RSI ${s.rsi14.toFixed(0)} — momentum resetting, not broken`,
      ],
    };
  }

  // --- Trend continuation: full EMA alignment, strong ADX, near highs
  const distHigh20 = Number.isFinite(s.priorHigh20) ? pct(s.close, s.priorHigh20) : NaN;
  if (
    s.ema9 > s.ema21 &&
    uptrend &&
    s.adx14 >= 25 &&
    s.supertrendDir === 1 &&
    distHigh20 >= -5 &&
    s.rsi14 >= 50 &&
    s.rsi14 <= 75 &&
    s.ret20 > 0
  ) {
    return {
      setup: 'TREND_CONTINUATION',
      evidence: [
        `EMAs stacked bullish (9 > 21 > 50 > SMA200), ADX ${s.adx14.toFixed(0)}`,
        `Within ${Math.abs(distHigh20).toFixed(1)}% of the 20-day high, Supertrend bullish`,
        `20-day return ${s.ret20.toFixed(1)}% with RSI ${s.rsi14.toFixed(0)} (not overbought)`,
      ],
    };
  }

  // --- Reversal: washed-out RSI, holding above the 20-day low, volume confirmation
  if (
    s.minRsi5 <= 32 &&
    s.rsi14 > s.minRsi5 + 3 &&
    s.close > s.prevClose &&
    s.close > s.open &&
    s.relVol >= 1.3 &&
    Number.isFinite(s.priorLow20) &&
    s.low >= s.priorLow20 * 0.99 &&
    s.close > s.sma200 * 0.9 &&
    s.macdHist > -Infinity
  ) {
    return {
      setup: 'REVERSAL',
      evidence: [
        `RSI washed out to ${s.minRsi5.toFixed(0)} in the last 5 sessions and now recovering (${s.rsi14.toFixed(0)})`,
        `Held the 20-day low (₹${s.priorLow20.toFixed(1)}) and closed higher on ${s.relVol.toFixed(1)}× volume`,
        'Bullish candle — potential mean-reversion bounce',
      ],
    };
  }

  return { setup: 'NONE', evidence: [] };
}
