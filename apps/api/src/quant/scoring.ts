import type { FactorName, FactorScore, FactorWeights, SectorStrengthDto, SetupType } from '@nse/shared';
import type { FundamentalsSnapshot } from '../data/providers/market-data.provider.js';
import type { FeatureKey, RegimeResult, StockSnapshot, TradeLevels } from './types.js';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);

/** Cross-sectional percentile ranks for a single date (0-100). */
export class CrossSection {
  private sorted = new Map<FeatureKey | 'rs20' | 'rs60', Float64Array>();

  constructor(snaps: StockSnapshot[], niftyRet20: number, niftyRet60: number) {
    const keys: FeatureKey[] = ['ret5', 'ret20', 'ret60', 'relVol', 'adx14', 'roc10'];
    for (const k of keys) {
      const arr = Float64Array.from(snaps.map((s) => s[k]).filter(Number.isFinite)).sort();
      this.sorted.set(k, arr);
    }
    this.sorted.set('rs20', Float64Array.from(snaps.map((s) => s.ret20 - niftyRet20).filter(Number.isFinite)).sort());
    this.sorted.set('rs60', Float64Array.from(snaps.map((s) => s.ret60 - niftyRet60).filter(Number.isFinite)).sort());
  }

  pct(key: FeatureKey | 'rs20' | 'rs60', value: number): number {
    const arr = this.sorted.get(key);
    if (!arr || !arr.length || !Number.isFinite(value)) return 50;
    // binary search for first element > value
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return (lo / arr.length) * 100;
  }
}

export interface ScoreInput {
  snap: StockSnapshot;
  setup: SetupType;
  cs: CrossSection;
  sector: SectorStrengthDto | undefined;
  regime: RegimeResult;
  levels: TradeLevels;
  fundamentals: FundamentalsSnapshot | null;
  weights: FactorWeights;
  setupSuccessRate: number | null;
}

export interface ScoreResult {
  total: number;
  confidence: number;
  factors: FactorScore[];
  raw: Record<FactorName, number>;
}

/** Compute the ten raw factor scores (0-100 each). Weight-independent so backtests can re-weight cheaply. */
export function computeRawFactors(i: Omit<ScoreInput, 'weights' | 'setupSuccessRate'>): { raw: Record<FactorName, number>; notes: Record<FactorName, string> } {
  const { snap: s, cs, sector, regime, levels } = i;
  const raw = {} as Record<FactorName, number>;
  const notes = {} as Record<FactorName, string>;

  // Momentum: percentile of multi-horizon returns + RSI zone + MACD histogram
  {
    const p5 = cs.pct('ret5', s.ret5);
    const p20 = cs.pct('ret20', s.ret20);
    const p60 = cs.pct('ret60', s.ret60);
    let v: number;
    if (i.setup === 'STAGE2_PULLBACK' || i.setup === 'PULLBACK') {
      // Pullbacks pause short-term: assess medium/longer-term strength + clean RSI reset
      v = p20 * 0.45 + p60 * 0.4 + 15;
      if (s.rsi14 >= 40 && s.rsi14 <= 60) v += 8; // pristine pullback zone
      if (s.close > s.open) v += 5; // bounce candle
    } else if (i.setup === 'VCP_BREAKOUT') {
      v = p5 * 0.3 + p20 * 0.4 + p60 * 0.3 + 8;
      if (s.rsi14 >= 55 && s.rsi14 <= 74) v += 6;
    } else {
      v = p5 * 0.25 + p20 * 0.45 + p60 * 0.3;
      if (s.rsi14 >= 55 && s.rsi14 <= 72) v += 6;
      else if (s.rsi14 > 80) v -= 10;
    }
    if (s.macdHist > 0) v += 4;
    if (s.stochRsi > 85 && s.ret5 > 8) v -= 6; // stretched short-term
    raw.momentum = clamp(v);
    notes.momentum = `20d return ${fin(s.ret20).toFixed(1)}% (${p20.toFixed(0)}th pct), 60d ${fin(s.ret60).toFixed(1)}%, RSI ${fin(s.rsi14).toFixed(0)}`;
  }

  // Trend: EMA alignment, position vs SMA200, ADX, Supertrend
  {
    let v = 0;
    if (s.close > s.ema9) v += 10;
    if (s.ema9 > s.ema21) v += 15;
    if (s.ema21 > s.ema50) v += 15;
    if (s.ema50 > s.sma200) v += 15;
    if (s.close > s.sma200) v += 10;
    if (s.supertrendDir === 1) v += 10;
    v += clamp(((fin(s.adx14) - 15) / 25) * 25, 0, 25);
    if (i.setup === 'STAGE2_PULLBACK' && s.ema21 > s.ema50 && s.ema50 > s.sma200) v += 5;
    raw.trend = clamp(v);
    const stack = [s.ema9 > s.ema21, s.ema21 > s.ema50, s.ema50 > s.sma200].filter(Boolean).length;
    notes.trend = `${stack}/3 EMA alignments bullish, ADX ${fin(s.adx14).toFixed(0)}, Supertrend ${s.supertrendDir === 1 ? 'up' : 'down'}`;
  }

  // Relative strength vs NIFTY and vs sector
  {
    const rs20 = s.ret20 - regime.nifty.ret20;
    const rs60 = s.ret60 - regime.nifty.ret60;
    const p20 = cs.pct('rs20', rs20);
    const p60 = cs.pct('rs60', rs60);
    let v = p20 * 0.6 + p60 * 0.4;
    if (sector) {
      const vsSector = s.ret20 - sector.momentum20;
      v += clamp(vsSector * 1.5, -10, 10);
    }
    raw.relativeStrength = clamp(v);
    notes.relativeStrength = `${rs20 >= 0 ? 'Out' : 'Under'}performing NIFTY by ${Math.abs(fin(rs20)).toFixed(1)}% over 20d${
      sector ? `, ${s.ret20 - sector.momentum20 >= 0 ? 'ahead of' : 'behind'} sector median` : ''
    }`;
  }

  // Volume: relative volume, OBV slope, up/down volume, delivery
  {
    let v = 30;
    v += clamp((fin(s.relVol, 1) - 1) * 25, -15, 30);
    v += clamp(fin(s.obvSlope10) * 40, -10, 15);
    v += clamp((fin(s.upDownVolRatio10, 1) - 1) * 15, -10, 15);
    if (Number.isFinite(s.deliveryPct) && Number.isFinite(s.avgDeliveryPct20)) {
      v += clamp((s.deliveryPct - s.avgDeliveryPct20) * 0.5, -8, 10);
      if (s.deliveryPct >= 45 && s.relVol >= 1.5) v += 8; // Institutional delivery shock
    }
    raw.volume = clamp(v);
    notes.volume = `Volume ${fin(s.relVol, 1).toFixed(1)}× avg, up/down volume ratio ${fin(s.upDownVolRatio10, 1).toFixed(2)}${
      Number.isFinite(s.deliveryPct) ? `, delivery ${s.deliveryPct.toFixed(0)}%` : ''
    }`;
  }

  // Price structure: proximity to highs, higher lows, Bollinger position
  {
    let v = 20;
    const dHigh20 = Number.isFinite(s.priorHigh20) ? (s.close / s.priorHigh20 - 1) * 100 : NaN;
    const dHigh252 = Number.isFinite(s.high252) ? (s.close / s.high252 - 1) * 100 : NaN;
    if (Number.isFinite(dHigh20)) v += dHigh20 >= 0 ? 25 : clamp(25 + dHigh20 * 3, 0, 25);
    if (Number.isFinite(dHigh252)) v += dHigh252 >= -3 ? 20 : clamp(20 + (dHigh252 + 3) * 1, 0, 20);
    v += fin(s.higherLows) * 10;
    if (i.setup === 'VCP_BREAKOUT') v += 12; // VCP tightness reward
    if (i.setup === 'STAGE2_PULLBACK') v += 10; // Support holding reward
    if (s.bbPctB >= 0.5 && s.bbPctB <= 1.05) v += 10;
    else if (s.bbPctB > 1.15) v -= 5;
    const range = s.high - s.low;
    if (range > 0 && (s.close - s.low) / range >= 0.7) v += 5;
    raw.priceStructure = clamp(v);
    notes.priceStructure = `${Number.isFinite(dHigh252) ? `${Math.abs(dHigh252).toFixed(1)}% ${dHigh252 >= 0 ? 'above' : 'below'} 52-week high` : 'no 52w data'}, ${fin(s.higherLows)} higher swing lows`;
  }

  // Sector strength
  {
    raw.sectorStrength = sector ? clamp(sector.score) : 50;
    notes.sectorStrength = sector
      ? `${sector.sector} ranked #${sector.rank} (score ${sector.score.toFixed(0)}, RS ${sector.relativeStrength20 >= 0 ? '+' : ''}${sector.relativeStrength20.toFixed(1)}%)`
      : 'Sector unclassified — neutral';
  }

  // Market regime
  {
    raw.marketRegime = clamp(regime.regimeScore);
    notes.marketRegime = `${regime.regime.replace('_', ' ').toLowerCase()} regime (score ${regime.regimeScore.toFixed(0)}), volatility ${regime.volatilityRegime.toLowerCase()}`;
  }

  // Volatility: prefer tradeable ATR% (1.5–4%), penalise extremes and exploding bands
  {
    const a = fin(s.atrPct, 3);
    let v: number;
    if (a < 1) v = 35;
    else if (a < 1.5) v = 60;
    else if (a <= 4) v = 90;
    else if (a <= 6) v = 60;
    else v = 25;
    if (fin(s.hv20) > 60) v -= 15;
    raw.volatility = clamp(v);
    notes.volatility = `ATR ${a.toFixed(1)}% of price, 20d historical vol ${fin(s.hv20).toFixed(0)}%`;
  }

  // Fundamentals (neutral when no point-in-time data is available)
  {
    const f = i.fundamentals;
    if (!f) {
      raw.fundamentals = 50;
      notes.fundamentals = 'No point-in-time fundamentals source configured — neutral';
    } else {
      let v = 50;
      if (f.roe !== null) v += clamp((f.roe - 12) * 1.5, -15, 15);
      if (f.profitGrowth !== null) v += clamp(f.profitGrowth * 0.5, -10, 15);
      if (f.debtToEquity !== null) v += f.debtToEquity < 0.5 ? 8 : f.debtToEquity > 1.5 ? -10 : 0;
      if (f.promoterHolding !== null && f.promoterHolding > 50) v += 5;
      raw.fundamentals = clamp(v);
      notes.fundamentals = `ROE ${f.roe ?? '–'}%, profit growth ${f.profitGrowth ?? '–'}%, D/E ${f.debtToEquity ?? '–'}`;
    }
  }

  // Risk / reward from computed levels
  {
    const rr = levels.riskReward;
    const v = rr >= 3 ? 100 : rr >= 2.5 ? 85 : rr >= 2 ? 65 : rr >= 1.5 ? 40 : 20;
    raw.riskReward = v;
    notes.riskReward = `Risk ${levels.riskPct.toFixed(1)}% vs reward ${levels.rewardPct.toFixed(1)}% → ${rr.toFixed(2)}:1`;
  }

  return { raw, notes };
}

export function applyWeights(raw: Record<FactorName, number>, weights: FactorWeights, notes?: Record<FactorName, string>): { total: number; factors: FactorScore[] } {
  const factors: FactorScore[] = [];
  let total = 0;
  for (const name of Object.keys(weights) as FactorName[]) {
    const w = weights[name];
    const r = raw[name] ?? 50;
    const weighted = (r * w) / 100;
    total += weighted;
    factors.push({ name, raw: Math.round(r * 10) / 10, weight: w, weighted: Math.round(weighted * 100) / 100, note: notes?.[name] ?? '' });
  }
  return { total: Math.round(total * 10) / 10, factors };
}

export function confidenceFrom(total: number, raw: Record<FactorName, number>, setupSuccessRate: number | null, longBias: number): number {
  const agreeing = (Object.values(raw).filter((v) => v >= 60).length / Object.keys(raw).length) * 100;
  const hist = setupSuccessRate === null ? 50 : setupSuccessRate * 100;
  const c = total * 0.45 + hist * 0.3 + agreeing * 0.25;
  return Math.round(clamp(c * (0.7 + 0.3 * longBias)));
}

export function buildReasons(setupEvidence: string[], factors: FactorScore[], regime: RegimeResult, sector: SectorStrengthDto | undefined): string[] {
  const reasons = [...setupEvidence];
  const top = [...factors].sort((a, b) => b.raw - a.raw).slice(0, 3);
  for (const f of top) if (f.note) reasons.push(f.note);
  if (sector && sector.rank <= 3) reasons.push(`${sector.sector} is among the 3 strongest sectors today`);
  if (regime.regime === 'BEARISH' || regime.regime === 'STRONG_BEARISH') {
    reasons.push(`Caution: market regime is ${regime.regime.replace('_', ' ').toLowerCase()} — position size accordingly`);
  }
  return reasons;
}
