import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { loadConfig } from '../config/app.config.js';
import { DailyRunService } from '../engine/daily-run.service.js';

/**
 * Registers the end-of-day cron (default 18:45 IST on weekdays). NSE publishes the
 * final bhavcopy around 18:30 IST; if it is not there yet the run still analyses
 * the latest available date and the next scheduled run picks up the new file.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly log = new Logger(SchedulerService.name);
  private readonly cfg = loadConfig();

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly daily: DailyRunService,
  ) {}

  onModuleInit() {
    if (!this.cfg.scheduler.enabled) {
      this.log.log('Scheduler disabled (SCHEDULER_ENABLED=false)');
      return;
    }
    const job = new CronJob(
      this.cfg.scheduler.dailyRunCron,
      () => void this.daily.runScheduled(),
      null,
      true,
      this.cfg.scheduler.timezone,
    );
    this.registry.addCronJob('daily-run', job);
    this.log.log(`Daily run scheduled: "${this.cfg.scheduler.dailyRunCron}" (${this.cfg.scheduler.timezone})`);
  }
}
