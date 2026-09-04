import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { AiAnalystService } from './ai-analyst.service.js';
import { AnalystController } from './analyst.controller.js';
import { AnalystService } from './analyst.service.js';
import { NewsService } from './news.service.js';

@Module({
  imports: [EngineModule],
  controllers: [AnalystController],
  providers: [AnalystService, NewsService, AiAnalystService],
})
export class AnalystModule {}
