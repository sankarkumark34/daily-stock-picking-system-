import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './api/api.module.js';
import { BacktestModule } from './backtest/backtest.module.js';
import { DataModule } from './data/data.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EngineModule } from './engine/engine.module.js';
import { SchedulerService } from './scheduler/scheduler.service.js';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), DataModule, EngineModule, BacktestModule, ApiModule],
  providers: [SchedulerService],
})
export class AppModule {}
