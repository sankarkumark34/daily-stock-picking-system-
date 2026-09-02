import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { BacktestController } from './backtest.controller.js';
import { BacktestService } from './backtest.service.js';

@Module({
  imports: [EngineModule],
  controllers: [BacktestController],
  providers: [BacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
