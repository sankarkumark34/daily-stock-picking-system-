import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/app.config.js';
import { StockEntity } from './entities/stock.entity.js';
import { DailyBarEntity } from './entities/daily-bar.entity.js';
import { IndexBarEntity } from './entities/index-bar.entity.js';
import { MarketSnapshotEntity } from './entities/market-snapshot.entity.js';
import { PredictionEntity } from './entities/prediction.entity.js';
import { BacktestRunEntity } from './entities/backtest-run.entity.js';
import { IngestLogEntity } from './entities/ingest-log.entity.js';

export const ENTITIES = [
  StockEntity,
  DailyBarEntity,
  IndexBarEntity,
  MarketSnapshotEntity,
  PredictionEntity,
  BacktestRunEntity,
  IngestLogEntity,
];

export function buildTypeOrmOptions() {
  const cfg = loadConfig();
  if (cfg.db.type === 'postgres') {
    if (!cfg.db.postgresUrl) throw new Error('DATABASE_URL is required when DB_TYPE=postgres');
    return {
      type: 'postgres' as const,
      url: cfg.db.postgresUrl,
      entities: ENTITIES,
      synchronize: cfg.db.synchronize,
      logging: false,
    };
  }
  fs.mkdirSync(path.dirname(cfg.db.sqlitePath), { recursive: true });
  return {
    type: 'better-sqlite3' as const,
    database: cfg.db.sqlitePath,
    entities: ENTITIES,
    synchronize: cfg.db.synchronize,
    logging: false,
    prepareDatabase: (db: { pragma: (s: string) => unknown }) => {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000');
      db.pragma('temp_store = MEMORY');
    },
  };
}

@Global()
@Module({
  imports: [TypeOrmModule.forRoot(buildTypeOrmOptions()), TypeOrmModule.forFeature(ENTITIES)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
