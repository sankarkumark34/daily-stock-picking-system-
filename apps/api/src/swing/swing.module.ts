import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { SwingController } from './swing.controller.js';
import { SwingService } from './swing.service.js';

@Module({
  imports: [EngineModule],
  controllers: [SwingController],
  providers: [SwingService],
  exports: [SwingService],
})
export class SwingModule {}
