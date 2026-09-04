/**
 * Shared contracts between the NestJS API and the React dashboard.
 * Keep this file free of runtime dependencies.
 */

export type Direction = 'LONG' | 'AVOID';

export type MarketRegime =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'SIDEWAYS'
  | 'BEARISH'
  | 'STRONG_BEARISH';

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH';

export type SetupType =
  | 'BREAKOUT'
  | 'PULLBACK'
  | 'TREND_CONTINUATION'
  | 'REVERSAL'
  | 'NONE';

export type PredictionOutcome =
  | 'OPEN'
  | 'SUCCESS'
  | 'FAILURE'
  | 'EXPIRED'
  | 'NO_FILL';

export type FactorName =
  | 'momentum'
  | 'trend'
  | 'relativeStrength'
  | 'volume'
  | 'priceStructure'
  | 'sectorStrength'
  | 'marketRegime'
  | 'volatility'
  | 'fundamentals'
  | 'riskReward';

export type FactorWeights = Record<FactorName, number>;

export const FACTOR_NAMES: FactorName[] = [
  'momentum',
  'trend',
  'relativeStrength',
  'volume',
  'priceStructure',
  'sectorStrength',
  'marketRegime',
  'volatility',
  'fundamentals',
  'riskReward',
];

export const FACTOR_LABELS: Record<FactorName, string> = {
  momentum: 'Momentum',
  trend: 'Trend',
  relativeStrength: 'Relative Strength',
  volume: 'Volume',
  priceStructure: 'Price Structure',
  sectorStrength: 'Sector Strength',
  marketRegime: 'Market Regime',
  volatility: 'Volatility',
  fundamentals: 'Fundamentals',
  riskReward: 'Risk / Reward',
};

/** Initial model weights (sum = 100). Backtesting decides whether these hold. */
export const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  momentum: 15,
  trend: 15,
  relativeStrength: 15,
  volume: 10,
  priceStructure: 10,
  sectorStrength: 10,
  marketRegime: 10,
  volatility: 5,
  fundamentals: 5,
  riskReward: 5,
};

export const REGIME_LABELS: Record<MarketRegime, string> = {
  STRONG_BULLISH: 'Strong Bullish',
  BULLISH: 'Bullish',
  SIDEWAYS: 'Sideways',
  BEARISH: 'Bearish',
  STRONG_BEARISH: 'Strong Bearish',
};

export const SETUP_LABELS: Record<SetupType, string> = {
  BREAKOUT: 'Breakout',
  PULLBACK: 'Pullback',
  TREND_CONTINUATION: 'Trend Continuation',
  REVERSAL: 'Reversal',
  NONE: 'None',
};

export interface FactorScore {
  name: FactorName;
  /** 0-100 raw factor score */
  raw: number;
  /** weight in points (sum of all weights = 100) */
  weight: number;
  /** raw * weight / 100 */
  weighted: number;
  note: string;
}

export interface PickDto {
  id: number;
  date: string;
  rank: number;
  symbol: string;
  name: string | null;
  sector: string;
  score: number;
  confidence: number;
  direction: Direction;
  setup: SetupType;
  setupSuccessRate: number | null;
  entryLow: number;
  entryHigh: number;
  entry: number;
  target: number;
  stopLoss: number;
  riskReward: number;
  riskPct: number;
  rewardPct: number;
  holdDays: number;
  reasons: string[];
  factors: FactorScore[];
  regime: MarketRegime;
  outcome: PredictionOutcome;
  outcomeDate: string | null;
  exitPrice: number | null;
  grossReturnPct: number | null;
  netReturnPct: number | null;
  daysHeld: number | null;
  isBacktest: boolean;
}

export interface SectorStrengthDto {
  date: string;
  sector: string;
  rank: number;
  score: number;
  momentum5: number;
  momentum20: number;
  relativeStrength20: number;
  breadthAboveEma21: number;
  breadthRisingEma21: number;
  relativeVolume: number;
  constituents: number;
}

export interface MarketOverviewDto {
  date: string;
  regime: MarketRegime;
  volatilityRegime: VolatilityRegime;
  regimeScore: number;
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
  breadth: {
    advances: number;
    declines: number;
    unchanged: number;
    advanceDeclineRatio: number;
    pctAboveSma50: number;
    pctAboveSma200: number;
    pctAboveEma21: number;
    newHighs20: number;
    newLows20: number;
  };
  universeSize: number;
  sectors: SectorStrengthDto[];
  notes: string[];
}

export interface PerformanceWindowDto {
  label: string;
  fromDate: string;
  toDate: string;
  picks: number;
  filled: number;
  success: number;
  failure: number;
  expired: number;
  open: number;
  hitRate: number | null;
  directionalAccuracy: number | null;
  avgNetReturnPct: number | null;
  expectancyPct: number | null;
  profitFactor: number | null;
}

export interface GroupStatsDto {
  key: string;
  trades: number;
  hitRate: number | null;
  directionalAccuracy: number | null;
  avgNetReturnPct: number | null;
  expectancyPct: number | null;
  profitFactor: number | null;
}

export interface DailyHitRatePoint {
  date: string;
  picks: number;
  success: number;
  failure: number;
  expired: number;
  hitRate: number | null;
  avgNetReturnPct: number | null;
  regime: MarketRegime | null;
}

export interface PerformanceSummaryDto {
  asOf: string;
  windows: PerformanceWindowDto[];
  byRegime: GroupStatsDto[];
  bySetup: GroupStatsDto[];
  daily: DailyHitRatePoint[];
}

export interface BacktestMetrics {
  trades: number;
  filled: number;
  noFill: number;
  success: number;
  failure: number;
  expired: number;
  winRate: number | null;
  lossRate: number | null;
  targetHitRate: number | null;
  stopHitRate: number | null;
  expiredRate: number | null;
  directionalAccuracy: number | null;
  profitFactor: number | null;
  expectancyPct: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  avgNetReturnPct: number | null;
  medianNetReturnPct: number | null;
  totalNetReturnPct: number | null;
  maxDrawdownPct: number | null;
  sharpe: number | null;
  sortino: number | null;
  cagrPct: number | null;
  avgHoldingDays: number | null;
  tradingDays: number;
  daysWithPicks: number;
  avgPicksPerDay: number | null;
  avgDailyHitRate: number | null;
  medianDailyHitRate: number | null;
  daysWith6PlusOf10: number;
  totalCostPct: number | null;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdownPct: number;
}

export interface RollingHitRatePoint {
  date: string;
  hitRate30: number | null;
  hitRate90: number | null;
  hitRate180: number | null;
  hitRate365: number | null;
}

export interface WalkForwardSplitResult {
  label: string;
  train: { from: string; to: string; metrics: BacktestMetrics | null };
  validate: { from: string; to: string; metrics: BacktestMetrics | null };
  test: { from: string; to: string; metrics: BacktestMetrics | null };
  weights: FactorWeights;
  baselineTestMetrics: BacktestMetrics | null;
}

export interface TradingCostConfig {
  brokeragePct: number;
  sttPct: number;
  exchangePct: number;
  sebiPct: number;
  stampDutyPct: number;
  gstPct: number;
  slippagePct: number;
}

export const DEFAULT_TRADING_COSTS: TradingCostConfig = {
  brokeragePct: 0.03,
  sttPct: 0.1,
  exchangePct: 0.00297,
  sebiPct: 0.0001,
  stampDutyPct: 0.015,
  gstPct: 18,
  slippagePct: 0.05,
};

export interface BacktestParams {
  fromDate: string;
  toDate: string;
  maxPicks: number;
  minScore: number;
  holdDays: number;
  maxPerSector: number;
  weights: FactorWeights;
  costs: TradingCostConfig;
  walkForward: boolean;
  optimizeWeights: boolean;
  label?: string;
}

export type BacktestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Sanity numbers that explain *why* a backtest produced the picks it did. */
export interface BacktestDiagnostics {
  analysedDays: number;
  avgUniverseSize: number;
  avgCandidatesPerDay: number;
  candidatesBySetup: Record<string, number>;
  selectedBySetup: Record<string, number>;
  selectedScore: { min: number; p25: number; median: number; p75: number; max: number } | null;
  daysWithFewerThanMax: number;
  regimeDays: Record<string, number>;
}

export interface BacktestRunDto {
  id: number;
  label: string;
  status: BacktestStatus;
  createdAt: string;
  finishedAt: string | null;
  params: BacktestParams;
  metrics: BacktestMetrics | null;
  byRegime: GroupStatsDto[];
  bySetup: GroupStatsDto[];
  byYear: GroupStatsDto[];
  daily: DailyHitRatePoint[];
  equity: EquityPoint[];
  rolling: RollingHitRatePoint[];
  walkForward: WalkForwardSplitResult[];
  diagnostics: BacktestDiagnostics | null;
  verdict: string;
  error: string | null;
  progress: number;
}

export interface BacktestRunSummaryDto {
  id: number;
  label: string;
  status: BacktestStatus;
  createdAt: string;
  fromDate: string;
  toDate: string;
  trades: number | null;
  winRate: number | null;
  expectancyPct: number | null;
  profitFactor: number | null;
  progress: number;
}

export interface IngestLogDto {
  id: number;
  date: string;
  source: string;
  status: 'OK' | 'EMPTY' | 'ERROR';
  rows: number;
  message: string | null;
  createdAt: string;
}

export interface BackfillJobDto {
  id: string;
  type: 'BACKFILL' | 'INGEST' | 'DAILY_RUN' | 'EVALUATE';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  fromDate: string;
  toDate: string;
  processed: number;
  total: number;
  currentDate: string | null;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface DataStatusDto {
  symbols: number;
  bars: number;
  firstDate: string | null;
  lastDate: string | null;
  tradingDays: number;
  indexBars: number;
  predictions: number;
  sectorsMapped: number;
  job: BackfillJobDto | null;
  recentLogs: IngestLogDto[];
}

export interface BarDto {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  deliveryPct: number | null;
}

export interface StockDetailDto {
  symbol: string;
  name: string | null;
  sector: string;
  industry: string | null;
  bars: BarDto[];
  indicators: {
    ema9: (number | null)[];
    ema21: (number | null)[];
    ema50: (number | null)[];
    sma200: (number | null)[];
    rsi14: (number | null)[];
    atr14: (number | null)[];
  };
  latest: Record<string, number | string | boolean | null>;
  history: PickDto[];
}

/* ---------------- Stock Analyst ---------------- */

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'NA';
export type AnalystVerdict = 'BUY' | 'WATCH' | 'AVOID';

export interface ChecklistItem {
  id: string;
  group: string;
  label: string;
  status: CheckStatus;
  value: string;
  detail: string;
  /** Critical items force AVOID when they FAIL (e.g. liquidity). */
  critical: boolean;
}

export interface HorizonReturn {
  label: string;
  days: number;
  stock: number | null;
  nifty: number | null;
  excess: number | null;
}

export interface StressStat {
  id: string;
  label: string;
  description: string;
  days: number;
  stockAvg: number | null;
  niftyAvg: number | null;
  stockUpPct: number | null;
  nextDayStockAvg: number | null;
}

export interface ConditionalStat {
  id: string;
  label: string;
  description: string;
  occurrences: number;
  medianFwd5: number | null;
  winRate5: number | null;
  medianFwd10: number | null;
  winRate10: number | null;
  medianFwd20: number | null;
  winRate20: number | null;
}

export interface NewsItem {
  title: string;
  source: string | null;
  url: string;
  publishedAt: string | null;
}

export interface AiAnalystNote {
  model: string;
  generatedAt: string;
  summary: string;
  newsImpact: string;
  macroExposure: string;
  positives: string[];
  negatives: string[];
  risks: string[];
  catalysts: string[];
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentimentScore: number;
  stance: AnalystVerdict;
  stanceReason: string;
}

export interface StockAnalysisDto {
  symbol: string;
  name: string | null;
  sector: string;
  industry: string | null;
  asOf: string;
  price: number;
  changePct: number | null;
  verdict: AnalystVerdict;
  score: number;
  checklist: ChecklistItem[];
  checklistSummary: { pass: number; warn: number; fail: number; na: number };
  positives: string[];
  negatives: string[];
  returns: HorizonReturn[];
  risk: {
    beta1y: number | null;
    correlation1y: number | null;
    annualVolPct: number | null;
    maxDrawdown1yPct: number | null;
    drawdownFrom52wHighPct: number | null;
    atrPct: number | null;
    avgTurnoverCr: number | null;
  };
  stress: StressStat[];
  conditional: ConditionalStat[];
  /** Traded value (₹) today / last 5 sessions / last 21 sessions vs the configured floors. */
  liquidity: {
    day: number;
    week: number;
    month: number;
    minDay: number;
    minWeek: number;
    minMonth: number;
    pass: boolean;
  };
  setup: SetupType;
  levels: { entry: number; target: number; stopLoss: number; riskReward: number; riskPct: number; rewardPct: number; holdDays: number } | null;
  factors: FactorScore[];
  regime: MarketRegime | null;
  sectorRank: number | null;
  sectorScore: number | null;
  news: NewsItem[];
  sectorNews: NewsItem[];
  newsError: string | null;
  /** Whether the AI analyst endpoint is configured (credentials + enabled). */
  aiAvailable: boolean;
  pickHistory: PickDto[];
  caveat: string;
}

export interface AiNoteResponseDto {
  status: 'OK' | 'DISABLED' | 'ERROR';
  note: AiAnalystNote | null;
  message: string | null;
}

export interface AnalystAnswerDto {
  question: string;
  answer: string;
  model: string;
  generatedAt: string;
}

export interface DailyRunResultDto {
  date: string;
  picks: PickDto[];
  overview: MarketOverviewDto;
  evaluated: number;
  durationMs: number;
}
