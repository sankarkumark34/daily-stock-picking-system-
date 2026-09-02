import type { MarketRegime, VolatilityRegime } from '@nse/shared';
import { ema, sma } from './indicators.js';
import type { BreadthStats, IndexSeries, RegimeResult, StockSnapshot } from './types.js';

export interface IndexFeatures {
  ema21: Float64Array;
  sma50: Float64Array;
  sma200: Float64Array;
}

export function computeIndexFeatures(idx: IndexSeries): IndexFeatures {
  return { ema21: ema(idx.close, 21), sma50: sma(idx.close, 50), sma200: sma(idx.close, 200) };
}

export function computeBreadth(snaps: StockSnapshot[]): BreadthStats {
  let adv = 0;
  let dec = 0;
  let unch = 0;
  let a50 = 0;
  let a200 = 0;
  let a21 = 0;
  let nh = 0;
  let nl = 0;
  for (const s of snaps) {
    if (s.close > s.prevClose) adv++;
    else if (s.close < s.prevClose) dec++;
    else unch++;
    if (s.close > s.sma50) a50++;
    if (s.close > s.sma200) a200++;
    if (s.close > s.ema21) a21++;
    if (s.close > s.priorHigh20) nh++;
    if (s.close < s.priorLow20) nl++;
  }
  const n = Math.max(1, snaps.length);
  return {
    universeSize: snaps.length,
    advances: adv,
    declines: dec,
    unchanged: unch,
    advanceDeclineRatio: dec === 0 ? adv : adv / dec,
    pctAboveSma50: (a50 / n) * 100,
    pctAboveSma200: (a200 / n) * 100,
    pctAboveEma21: (a21 / n) * 100,
    newHighs20: nh,
    newLows20: nl,
  };
}

const ret = (c: Float64Array, i: number, n: number) => (i >= n ? (c[i] / c[i - n] - 1) * 100 : NaN);

/**
 * Classify the market for one date using NIFTY trend, India VIX and breadth.
 * Score 0-100 → regime label → long bias multiplier.
 */
export function computeRegime(
  nifty: IndexSeries,
  nf: IndexFeatures,
  ni: number,
  vix: IndexSeries | null,
  vi: number,
  breadth: BreadthStats,
): RegimeResult {
  const c = nifty.close;
  const close = c[ni];
  const ret5 = ret(c, ni, 5);
  const ret20 = ret(c, ni, 20);
  const ret60 = ret(c, ni, 60);
  const aboveEma21 = close > nf.ema21[ni];
  const aboveSma50 = close > nf.sma50[ni];
  const aboveSma200 = close > nf.sma200[ni];
  const notes: string[] = [];

  // Trend component (0-50)
  let trend = 0;
  if (aboveEma21) trend += 12;
  if (aboveSma50) trend += 14;
  if (aboveSma200) trend += 14;
  if (ni >= 5 && nf.sma50[ni] > nf.sma50[ni - 5]) trend += 5;
  if (ni >= 20 && nf.sma200[ni] > nf.sma200[ni - 20]) trend += 5;

  // Momentum component (0-25)
  let mom = 12.5;
  if (!Number.isNaN(ret20)) mom += Math.max(-12.5, Math.min(12.5, ret20 * 1.5));
  if (!Number.isNaN(ret5)) mom += Math.max(-5, Math.min(5, ret5 * 1.5));
  mom = Math.max(0, Math.min(25, mom));

  // Breadth component (0-25)
  let br = 0;
  br += Math.min(12, (breadth.pctAboveSma50 / 100) * 12);
  br += Math.min(8, (breadth.pctAboveEma21 / 100) * 8);
  const adr = breadth.advanceDeclineRatio;
  br += adr >= 1.5 ? 5 : adr >= 1 ? 3 : adr >= 0.67 ? 1.5 : 0;

  let score = trend + mom + br;

  // VIX
  let vixInfo: RegimeResult['vix'] = null;
  let volatilityRegime: VolatilityRegime = 'NORMAL';
  if (vix && vi >= 0 && !Number.isNaN(vix.close[vi])) {
    const vc = vix.close[vi];
    let sum = 0;
    let cnt = 0;
    for (let j = Math.max(0, vi - 59); j <= vi; j++) {
      sum += vix.close[j];
      cnt++;
    }
    const avg60 = sum / cnt;
    const chg = vi > 0 ? (vc / vix.close[vi - 1] - 1) * 100 : 0;
    vixInfo = { close: vc, changePct: chg, avg60 };
    if (vc >= 20 || vc > avg60 * 1.25) {
      volatilityRegime = 'HIGH';
      score -= 12;
      notes.push(`India VIX elevated at ${vc.toFixed(1)} (60d avg ${avg60.toFixed(1)}) — long scores penalised.`);
    } else if (vc <= 13) {
      volatilityRegime = 'LOW';
      score += 3;
    }
  } else {
    notes.push('India VIX unavailable — volatility regime assumed NORMAL.');
  }

  score = Math.max(0, Math.min(100, score));

  let regime: MarketRegime;
  if (score >= 75) regime = 'STRONG_BULLISH';
  else if (score >= 58) regime = 'BULLISH';
  else if (score >= 40) regime = 'SIDEWAYS';
  else if (score >= 22) regime = 'BEARISH';
  else regime = 'STRONG_BEARISH';

  const longBias =
    regime === 'STRONG_BULLISH' ? 1 : regime === 'BULLISH' ? 0.9 : regime === 'SIDEWAYS' ? 0.7 : regime === 'BEARISH' ? 0.45 : 0.25;

  notes.push(
    `NIFTY ${aboveSma200 ? 'above' : 'below'} 200-SMA, ${aboveSma50 ? 'above' : 'below'} 50-SMA; 20d return ${ret20.toFixed(1)}%.`,
  );
  notes.push(
    `${breadth.pctAboveSma50.toFixed(0)}% of universe above 50-SMA, A/D ratio ${breadth.advanceDeclineRatio.toFixed(2)}.`,
  );

  return {
    regime,
    volatilityRegime,
    regimeScore: score,
    longBias,
    nifty: {
      close,
      changePct: ret(c, ni, 1),
      ret5,
      ret20,
      ret60,
      aboveEma21,
      aboveSma50,
      aboveSma200,
    },
    vix: vixInfo,
    breadth,
    notes,
  };
}
