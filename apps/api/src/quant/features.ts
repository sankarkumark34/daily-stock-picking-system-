import {
  adx,
  atr,
  bollinger,
  cci,
  ema,
  historicalVolatility,
  macd,
  nanMean,
  obv,
  priorRollingMax,
  priorRollingMin,
  priorSma,
  roc,
  rollingMax,
  rollingMin,
  rsi,
  sma,
  stochRsi,
  supertrend,
} from './indicators.js';
import { FEATURE_KEYS, type FeatureSeries, type StockSnapshot, type SymbolSeries } from './types.js';

/**
 * Compute the full indicator set for one symbol. All values at index i use only
 * bars [0..i], so a snapshot taken at i is free of look-ahead.
 */
export function computeFeatures(s: SymbolSeries): FeatureSeries {
  const n = s.close.length;
  const { close, high, low, volume, turnover } = s;

  const ema9 = ema(close, 9);
  const ema21 = ema(close, 21);
  const ema50 = ema(close, 50);
  const sma20 = sma(close, 20);
  const sma50 = sma(close, 50);
  const sma200 = sma(close, 200);
  const adxR = adx(high, low, close, 14);
  const st = supertrend(high, low, close, 10, 3);
  const rsi14 = rsi(close, 14);
  const m = macd(close);
  const stoch = stochRsi(rsi14, 14, 3);
  const roc10 = roc(close, 10);
  const roc20 = roc(close, 20);
  const cci20 = cci(high, low, close, 20);
  const atr14 = atr(high, low, close, 14);
  const bb = bollinger(close, 20, 2);
  const hv20 = historicalVolatility(close, 20);
  const avgVol20 = priorSma(volume, 20);
  const obvArr = obv(close, volume);
  const priorHigh20 = priorRollingMax(high, 20);
  const priorLow20 = priorRollingMin(low, 20);
  const high252 = rollingMax(high, 252);
  const low252 = rollingMin(low, 252);
  const avgTurnover20 = priorSma(turnover, 20);
  const turnover5 = rollingSum(turnover, 5);
  const turnover21 = rollingSum(turnover, 21);
  const avgDeliveryPct20 = nanMean(s.deliveryPct, 20);

  const f = {} as FeatureSeries;
  for (const k of FEATURE_KEYS) f[k] = new Float64Array(n).fill(NaN);

  f.ema9 = ema9;
  f.ema21 = ema21;
  f.ema50 = ema50;
  f.sma20 = sma20;
  f.sma50 = sma50;
  f.sma200 = sma200;
  f.adx14 = adxR.adx;
  f.supertrendDir = st.dir;
  f.rsi14 = rsi14;
  f.macdLine = m.line;
  f.macdSignal = m.signal;
  f.macdHist = m.hist;
  f.stochRsi = stoch;
  f.roc10 = roc10;
  f.roc20 = roc20;
  f.cci20 = cci20;
  f.atr14 = atr14;
  f.bbPctB = bb.pctB;
  f.bbWidth = bb.width;
  f.hv20 = hv20;
  f.avgVol20 = avgVol20;
  f.priorHigh20 = priorHigh20;
  f.priorLow20 = priorLow20;
  f.high252 = high252;
  f.low252 = low252;
  f.avgTurnover20 = avgTurnover20;
  f.turnover5 = turnover5;
  f.turnover21 = turnover21;
  f.avgDeliveryPct20 = avgDeliveryPct20;

  for (let i = 0; i < n; i++) {
    const c = close[i];
    f.atrPct[i] = atr14[i] / c * 100;
    f.relVol[i] = avgVol20[i] > 0 ? volume[i] / avgVol20[i] : NaN;
    if (i >= 1) f.ret1[i] = (c / close[i - 1] - 1) * 100;
    if (i >= 3) f.ret3[i] = (c / close[i - 3] - 1) * 100;
    if (i >= 5) f.ret5[i] = (c / close[i - 5] - 1) * 100;
    if (i >= 10) f.ret10[i] = (c / close[i - 10] - 1) * 100;
    if (i >= 20) f.ret20[i] = (c / close[i - 20] - 1) * 100;
    if (i >= 60) f.ret60[i] = (c / close[i - 60] - 1) * 100;
    if (i >= 10 && avgVol20[i] > 0) f.obvSlope10[i] = (obvArr[i] - obvArr[i - 10]) / (avgVol20[i] * 10);
    if (i >= 5 && !Number.isNaN(ema21[i - 5]) && ema21[i - 5] !== 0) {
      f.ema21Slope5[i] = (ema21[i] / ema21[i - 5] - 1) * 100;
    }

    // Max % distance above EMA21 over the previous 10 bars (for pullback detection)
    if (i >= 10) {
      let mx = -Infinity;
      for (let j = i - 10; j < i; j++) {
        const e = ema21[j];
        if (Number.isNaN(e) || e === 0) continue;
        const d = (close[j] / e - 1) * 100;
        if (d > mx) mx = d;
      }
      f.maxDistEma21_10[i] = mx === -Infinity ? NaN : mx;
      // min RSI over the previous 5 bars (including today)
      let mn = Infinity;
      for (let j = i - 4; j <= i; j++) if (rsi14[j] < mn) mn = rsi14[j];
      f.minRsi5[i] = mn === Infinity ? NaN : mn;
      // up-day volume vs down-day volume over last 10 bars
      let up = 0;
      let dn = 0;
      for (let j = i - 9; j <= i; j++) {
        if (close[j] > close[j - 1]) up += volume[j];
        else if (close[j] < close[j - 1]) dn += volume[j];
      }
      f.upDownVolRatio10[i] = dn === 0 ? (up > 0 ? 3 : 1) : Math.min(3, up / dn);
      // higher lows: count of last 3 five-bar swing lows that are ascending (0..2)
      const l1 = Math.min(low[i], low[i - 1], low[i - 2], low[i - 3], low[i - 4]);
      const l2 = Math.min(low[i - 5], low[i - 6], low[i - 7], low[i - 8], low[i - 9]);
      const l3 = i >= 15 ? Math.min(low[i - 10], low[i - 11], low[i - 12], low[i - 13], low[i - 14]) : NaN;
      let hl = 0;
      if (l1 > l2) hl++;
      if (!Number.isNaN(l3) && l2 > l3) hl++;
      f.higherLows[i] = hl;
    }
  }
  return f;
}

/** Sum of the last n values including the current bar (window clipped at the start). */
function rollingSum(src: Float64Array, n: number): Float64Array {
  const out = new Float64Array(src.length);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= n) sum -= src[i - n];
    out[i] = sum;
  }
  return out;
}

export function snapshotAt(s: SymbolSeries, f: FeatureSeries, i: number): StockSnapshot {
  const snap = {
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    date: s.dates[i],
    idx: i,
    bars: i + 1,
    open: s.open[i],
    high: s.high[i],
    low: s.low[i],
    close: s.close[i],
    prevClose: i > 0 ? s.close[i - 1] : NaN,
    volume: s.volume[i],
    turnover: s.turnover[i],
    deliveryPct: s.deliveryPct[i],
  } as StockSnapshot;
  for (const k of FEATURE_KEYS) snap[k] = f[k][i];
  return snap;
}
