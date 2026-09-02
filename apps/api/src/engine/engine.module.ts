import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module.js';
import { AnalysisService } from './analysis.service.js';
import { DailyRunService } from './daily-run.service.js';
import { MarketStoreService } from './market-store.service.js';

@Module({
  imports: [DataModule],
  providers: [MarketStoreService, AnalysisService, DailyRunService],
  exports: [MarketStoreService, AnalysisService, DailyRunService, DataModule],
})
export class EngineModule {}
