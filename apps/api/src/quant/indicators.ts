/**
 * Plain technical indicators over Float64Array inputs. Every function returns an
 * array of the same length with NaN where the indicator is not yet defined.
 * Implemented in-house so the maths is transparent and dependency-free.
 */

const F = (n: number) => {
  const a = new Float64Array(n);
  a.fill(NaN);
  return a;
};

/** NaN-aware: the output is NaN while any value inside the window is NaN. */
export function sma(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  let sum = 0;
  let nanInWindow = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (Number.isNaN(v)) nanInWindow++;
    else sum += v;
    if (i >= n) {
      const old = src[i - n];
      if (Number.isNaN(old)) nanInWindow--;
      else sum -= old;
    }
    if (i >= n - 1 && nanInWindow === 0) out[i] = sum / n;
  }
  return out;
}

export function ema(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  const k = 2 / (n + 1);
  let seeded = false;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (Number.isNaN(v)) continue;
    if (!seeded) {
      sum += v;
      count++;
      if (count === n) {
        out[i] = sum / n;
        seeded = true;
      }
      continue;
    }
    out[i] = v * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function rsi(close: Float64Array, n = 14): Float64Array {
  const out = F(close.length);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < close.length; i++) {
    const ch = close[i] - close[i - 1];
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    if (i <= n) {
      avgGain += gain / n;
      avgLoss += loss / n;
      if (i === n) out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      continue;
    }
    avgGain = (avgGain * (n - 1) + gain) / n;
    avgLoss = (avgLoss * (n - 1) + loss) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(close: Float64Array, fast = 12, slow = 26, signalN = 9) {
  const ef = ema(close, fast);
  const es = ema(close, slow);
  const line = F(close.length);
  for (let i = 0; i < close.length; i++) line[i] = ef[i] - es[i];
  const signal = ema(line, signalN);
  const hist = F(close.length);
  for (let i = 0; i < close.length; i++) hist[i] = line[i] - signal[i];
  return { line, signal, hist };
}

export function stochRsi(rsiArr: Float64Array, n = 14, smooth = 3): Float64Array {
  const raw = F(rsiArr.length);
  for (let i = n - 1; i < rsiArr.length; i++) {
    let mn = Infinity;
    let mx = -Infinity;
    let ok = true;
    for (let j = i - n + 1; j <= i; j++) {
      const v = rsiArr[j];
      if (Number.isNaN(v)) {
        ok = false;
        break;
      }
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (!ok) continue;
    raw[i] = mx === mn ? 50 : ((rsiArr[i] - mn) / (mx - mn)) * 100;
  }
  return sma(raw, smooth);
}

export function roc(close: Float64Array, n: number): Float64Array {
  const out = F(close.length);
  for (let i = n; i < close.length; i++) out[i] = (close[i] / close[i - n] - 1) * 100;
  return out;
}

export function cci(high: Float64Array, low: Float64Array, close: Float64Array, n = 20): Float64Array {
  const tp = new Float64Array(close.length);
  for (let i = 0; i < close.length; i++) tp[i] = (high[i] + low[i] + close[i]) / 3;
  const m = sma(tp, n);
  const out = F(close.length);
  for (let i = n - 1; i < close.length; i++) {
    let md = 0;
    for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]);
    md /= n;
    out[i] = md === 0 ? 0 : (tp[i] - m[i]) / (0.015 * md);
  }
  return out;
}

export function trueRange(high: Float64Array, low: Float64Array, close: Float64Array): Float64Array {
  const tr = new Float64Array(close.length);
  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      tr[i] = high[i] - low[i];
      continue;
    }
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
  }
  return tr;
}

/** Wilder smoothing (used by ATR / ADX). */
export function wilder(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    if (i < n) {
      sum += src[i];
      if (i === n - 1) out[i] = sum / n;
      continue;
    }
    out[i] = (out[i - 1] * (n - 1) + src[i]) / n;
  }
  return out;
}

export function atr(high: Float64Array, low: Float64Array, close: Float64Array, n = 14): Float64Array {
  return wilder(trueRange(high, low, close), n);
}

export function bollinger(close: Float64Array, n = 20, k = 2) {
  const mid = sma(close, n);
  const upper = F(close.length);
  const lower = F(close.length);
  const pctB = F(close.length);
  const width = F(close.length);
  for (let i = n - 1; i < close.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (close[j] - mid[i]) ** 2;
    const sd = Math.sqrt(s / n);
    upper[i] = mid[i] + k * sd;
    lower[i] = mid[i] - k * sd;
    const range = upper[i] - lower[i];
    pctB[i] = range === 0 ? 0.5 : (close[i] - lower[i]) / range;
    width[i] = mid[i] === 0 ? NaN : (range / mid[i]) * 100;
  }
  return { mid, upper, lower, pctB, width };
}

/** Annualised historical volatility (%) of log returns. */
export function historicalVolatility(close: Float64Array, n = 20): Float64Array {
  const out = F(close.length);
  const lr = new Float64Array(close.length);
  for (let i = 1; i < close.length; i++) lr[i] = Math.log(close[i] / close[i - 1]);
  for (let i = n; i < close.length; i++) {
    let mean = 0;
    for (let j = i - n + 1; j <= i; j++) mean += lr[j];
    mean /= n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (lr[j] - mean) ** 2;
    out[i] = Math.sqrt(v / (n - 1)) * Math.sqrt(252) * 100;
  }
  return out;
}

export function adx(high: Float64Array, low: Float64Array, close: Float64Array, n = 14) {
  const len = close.length;
  const plusDM = new Float64Array(len);
  const minusDM = new Float64Array(len);
  const tr = trueRange(high, low, close);
  for (let i = 1; i < len; i++) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }
  const sTR = wilder(tr, n);
  const sPlus = wilder(plusDM, n);
  const sMinus = wilder(minusDM, n);
  const plusDI = F(len);
  const minusDI = F(len);
  const dx = F(len);
  for (let i = 0; i < len; i++) {
    if (Number.isNaN(sTR[i]) || sTR[i] === 0) continue;
    plusDI[i] = (sPlus[i] / sTR[i]) * 100;
    minusDI[i] = (sMinus[i] / sTR[i]) * 100;
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100;
  }
  // ADX = Wilder smoothing of DX starting where DX becomes defined
  const adxOut = F(len);
  let start = -1;
  for (let i = 0; i < len; i++) {
    if (!Number.isNaN(dx[i])) {
      start = i;
      break;
    }
  }
  if (start >= 0) {
    let sum = 0;
    let cnt = 0;
    for (let i = start; i < len; i++) {
      if (cnt < n) {
        sum += dx[i];
        cnt++;
        if (cnt === n) adxOut[i] = sum / n;
        continue;
      }
      adxOut[i] = (adxOut[i - 1] * (n - 1) + dx[i]) / n;
    }
  }
  return { adx: adxOut, plusDI, minusDI };
}

/** Supertrend direction: +1 bullish, -1 bearish, NaN until defined. */
export function supertrend(high: Float64Array, low: Float64Array, close: Float64Array, n = 10, mult = 3) {
  const len = close.length;
  const a = atr(high, low, close, n);
  const dir = F(len);
  const line = F(len);
  let upper = NaN;
  let lower = NaN;
  let prevUpper = NaN;
  let prevLower = NaN;
  let d = 1;
  for (let i = 0; i < len; i++) {
    if (Number.isNaN(a[i])) continue;
    const mid = (high[i] + low[i]) / 2;
    let bu = mid + mult * a[i];
    let bl = mid - mult * a[i];
    if (!Number.isNaN(prevUpper)) {
      if (!(bu < prevUpper || close[i - 1] > prevUpper)) bu = prevUpper;
      if (!(bl > prevLower || close[i - 1] < prevLower)) bl = prevLower;
    }
    upper = bu;
    lower = bl;
    if (!Number.isNaN(prevUpper)) {
      if (d === -1 && close[i] > upper) d = 1;
      else if (d === 1 && close[i] < lower) d = -1;
    } else {
      d = close[i] >= mid ? 1 : -1;
    }
    dir[i] = d;
    line[i] = d === 1 ? lower : upper;
    prevUpper = upper;
    prevLower = lower;
  }
  return { dir, line };
}

export function obv(close: Float64Array, volume: Float64Array): Float64Array {
  const out = new Float64Array(close.length);
  for (let i = 1; i < close.length; i++) {
    const v = volume[i];
    out[i] = out[i - 1] + (close[i] > close[i - 1] ? v : close[i] < close[i - 1] ? -v : 0);
  }
  return out;
}

/** Rolling max of the *previous* n bars (excludes the current bar). */
export function priorRollingMax(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  for (let i = n; i < src.length; i++) {
    let m = -Infinity;
    for (let j = i - n; j < i; j++) if (src[j] > m) m = src[j];
    out[i] = m;
  }
  return out;
}

export function priorRollingMin(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  for (let i = n; i < src.length; i++) {
    let m = Infinity;
    for (let j = i - n; j < i; j++) if (src[j] < m) m = src[j];
    out[i] = m;
  }
  return out;
}

/** Rolling max including the current bar (window clipped at the start). */
export function rollingMax(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  for (let i = 0; i < src.length; i++) {
    let m = -Infinity;
    for (let j = Math.max(0, i - n + 1); j <= i; j++) if (src[j] > m) m = src[j];
    out[i] = m;
  }
  return out;
}

export function rollingMin(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  for (let i = 0; i < src.length; i++) {
    let m = Infinity;
    for (let j = Math.max(0, i - n + 1); j <= i; j++) if (src[j] < m) m = src[j];
    out[i] = m;
  }
  return out;
}

/** Simple mean of the previous n values (excluding current). */
export function priorSma(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < src.length; i++) {
    if (cnt >= n) out[i] = sum / n;
    const v = src[i];
    if (!Number.isNaN(v)) {
      sum += v;
      cnt++;
      if (cnt > n) sum -= src[i - n];
    }
  }
  return out;
}

export function nanMean(src: Float64Array, n: number): Float64Array {
  const out = F(src.length);
  for (let i = 0; i < src.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - n + 1); j <= i; j++) {
      const v = src[j];
      if (!Number.isNaN(v)) {
        s += v;
        c++;
      }
    }
    if (c >= Math.min(n, 5)) out[i] = s / c;
  }
  return out;
}
