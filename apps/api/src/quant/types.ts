import type { MarketRegime, VolatilityRegime } from '@nse/shared';

/** Column-oriented price history for one symbol (all arrays share the same index). */
export interface SymbolSeries {
  symbol: string;
  name: string | null;
  sector: string;
  dates: string[];
  open: Float64Array;
  high: Float64Array;
  low: Float64Array;
  close: Float64Array;
  volume: Float64Array;
  turnover: Float64Array;
  /** NaN when delivery data was not available */
  deliveryPct: Float64Array;
}

export interface IndexSeries {
  name: string;
  dates: string[];
  close: Float64Array;
}

export const FEATURE_KEYS = [
  'ema9',
  'ema21',
  'ema50',
  'sma20',
  'sma50',
  'sma200',
  'adx14',
  'supertrendDir',
  'rsi14',
  'macdLine',
  'macdSignal',
  'macdHist',
  'stochRsi',
  'roc10',
  'roc20',
  'cci20',
  'atr14',
  'atrPct',
  'bbPctB',
  'bbWidth',
  'hv20',
  'avgVol20',
  'relVol',
  'obvSlope10',
  'ret1',
  'ret3',
  'ret5',
  'ret10',
  'ret20',
  'ret60',
  'priorHigh20',
  'priorLow20',
  'high252',
  'low252',
  'avgTurnover20',
  'turnover5',
  'turnover21',
  'avgDeliveryPct20',
  'maxDistEma21_10',
  'minRsi5',
  'upDownVolRatio10',
  'higherLows',
  'ema21Slope5',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureSeries = Record<FeatureKey, Float64Array>;

export interface BaseSnapshot {
  symbol: string;
  name: string | null;
  sector: string;
  date: string;
  idx: number;
  bars: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  turnover: number;
  deliveryPct: number;
}

/** Everything the scoring engine may know about one stock on one date. */
export type StockSnapshot = BaseSnapshot & Record<FeatureKey, number>;

export interface BreadthStats {
  universeSize: number;
  advances: number;
  declines: number;
  unchanged: number;
  advanceDeclineRatio: number;
  pctAboveSma50: number;
  pctAboveSma200: number;
  pctAboveEma21: number;
  newHighs20: number;
  newLows20: number;
}

export interface RegimeResult {
  regime: MarketRegime;
  volatilityRegime: VolatilityRegime;
  /** 0-100, higher = friendlier for longs */
  regimeScore: number;
  /** 0-1 multiplier applied to long setups */
  longBias: number;
  nifty: {
    close: number;
    changePct: number;
    ret5: number;
    ret20: number;
    ret60: number;
    aboveEma21: boolean;
    aboveSma50: boolean;
    aboveSma200: boolean;
  };
  vix: { close: number; changePct: number; avg60: number } | null;
  breadth: BreadthStats;
  notes: string[];
}

export interface TradeLevels {
  entry: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  target: number;
  riskPct: number;
  rewardPct: number;
  riskReward: number;
  holdDays: number;
}

export interface TradeRecord {
  date: string;
  symbol: string;
  sector: string;
  setup: string;
  regime: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'EXPIRED' | 'NO_FILL' | 'OPEN';
  grossReturnPct: number | null;
  netReturnPct: number | null;
  outcomeDate: string | null;
  daysHeld: number | null;
}
