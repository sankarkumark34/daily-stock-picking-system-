import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { MarketController } from './market.controller.js';
import { PerformanceController } from './performance.controller.js';
import { PicksController } from './picks.controller.js';
import { RunController } from './run.controller.js';
import { StocksController } from './stocks.controller.js';

@Module({
  imports: [EngineModule],
  controllers: [MarketController, PicksController, PerformanceController, StocksController, RunController],
})
export class ApiModule {}
