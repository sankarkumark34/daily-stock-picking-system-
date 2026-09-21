import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './api/api.module.js';
import { DataModule } from './data/data.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EngineModule } from './engine/engine.module.js';
import { LiveModule } from './live/live.module.js';
import { SwingModule } from './swing/swing.module.js';
import { SchedulerService } from './scheduler/scheduler.service.js';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    DataModule,
    EngineModule,
    ApiModule,
    LiveModule,
    SwingModule,
  ],
  providers: [SchedulerService],
})
export class AppModule {}

