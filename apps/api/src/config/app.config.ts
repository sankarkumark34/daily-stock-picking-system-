import path from 'node:path';

export type DbType = 'sqlite' | 'postgres';

export interface AppConfig {
  port: number;
  db: {
    type: DbType;
    sqlitePath: string;
    postgresUrl: string | null;
    synchronize: boolean;
  };
  data: {
    cacheDir: string;
    requestDelayMs: number;
    userAgent: string;
  };
  scheduler: {
    enabled: boolean;
    /** cron expression in IST; NSE final bhavcopy is usually published ~18:30 IST */
    dailyRunCron: string;
    timezone: string;
  };
  model: {
    maxPicks: number;
    minScore: number;
    holdDays: number;
    maxPerSector: number;
    minAvgTurnoverCr: number;
    minPrice: number;
    minHistoryBars: number;
  };
  analyst: {
    /** Claude model used for the AI analyst note and Q&A */
    model: string;
    enabled: boolean;
  };
}

const bool = (v: string | undefined, d: boolean) =>
  v === undefined ? d : ['1', 'true', 'yes'].includes(v.toLowerCase());
const num = (v: string | undefined, d: number) => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Repo root is two levels above apps/api regardless of cwd used to start. */
const repoRoot = path.resolve(process.cwd().endsWith(path.join('apps', 'api')) ? path.join(process.cwd(), '..', '..') : process.cwd());

export function loadConfig(): AppConfig {
  const e = process.env;
  return {
    port: num(e.PORT, 4000),
    db: {
      type: (e.DB_TYPE as DbType) === 'postgres' ? 'postgres' : 'sqlite',
      sqlitePath: e.SQLITE_PATH ?? path.join(repoRoot, 'data', 'nse-picks.sqlite'),
      postgresUrl: e.DATABASE_URL ?? null,
      synchronize: bool(e.DB_SYNC, true),
    },
    data: {
      cacheDir: e.DATA_CACHE_DIR ?? path.join(repoRoot, 'data', 'cache'),
      requestDelayMs: num(e.NSE_REQUEST_DELAY_MS, 400),
      userAgent:
        e.NSE_USER_AGENT ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    scheduler: {
      enabled: bool(e.SCHEDULER_ENABLED, true),
      dailyRunCron: e.DAILY_RUN_CRON ?? '45 18 * * 1-5',
      timezone: e.TZ_NAME ?? 'Asia/Kolkata',
    },
    model: {
      maxPicks: num(e.MODEL_MAX_PICKS, 10),
      minScore: num(e.MODEL_MIN_SCORE, 72),
      holdDays: num(e.MODEL_HOLD_DAYS, 5),
      maxPerSector: num(e.MODEL_MAX_PER_SECTOR, 3),
      minAvgTurnoverCr: num(e.MODEL_MIN_TURNOVER_CR, 5),
      minPrice: num(e.MODEL_MIN_PRICE, 30),
      minHistoryBars: num(e.MODEL_MIN_HISTORY_BARS, 220),
    },
    analyst: {
      model: e.ANALYST_MODEL ?? 'claude-opus-5',
      enabled: bool(e.ANALYST_AI_ENABLED, true),
    },
  };
}

export const APP_CONFIG = 'APP_CONFIG';
