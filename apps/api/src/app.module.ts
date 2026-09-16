import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalystModule } from './analyst/analyst.module.js';
import { ApiModule } from './api/api.module.js';
import { BacktestModule } from './backtest/backtest.module.js';
import { DataModule } from './data/data.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EngineModule } from './engine/engine.module.js';
import { LiveModule } from './live/live.module.js';
import { IposModule } from './ipos/ipos.module.js';
import { CircuitModule } from './circuit/circuit.module.js';
import { SchedulerService } from './scheduler/scheduler.service.js';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), DataModule, EngineModule, BacktestModule, ApiModule, AnalystModule, LiveModule, IposModule, CircuitModule],
  providers: [SchedulerService],

})
export class AppModule {}
