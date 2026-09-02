import { Module } from '@nestjs/common';
import { JobsService } from '../engine/jobs.service.js';
import { DataController } from './data.controller.js';
import { DataService } from './data.service.js';
import { FUNDAMENTALS_PROVIDER, MARKET_DATA_PROVIDER, NoopFundamentalsProvider } from './providers/market-data.provider.js';
import { NseArchivesProvider } from './providers/nse-archives.provider.js';

@Module({
  controllers: [DataController],
  providers: [
    JobsService,
    DataService,
    { provide: MARKET_DATA_PROVIDER, useClass: NseArchivesProvider },
    { provide: FUNDAMENTALS_PROVIDER, useClass: NoopFundamentalsProvider },
  ],
  exports: [DataService, JobsService, MARKET_DATA_PROVIDER, FUNDAMENTALS_PROVIDER],
})
export class DataModule {}
