import { Injectable } from '@nestjs/common';
import type { BackfillJobDto } from '@nse/shared';
import { randomUUID } from 'node:crypto';

/** In-process tracker for long-running jobs (backfill, daily run) so the UI can poll progress. */
@Injectable()
export class JobsService {
  private current: BackfillJobDto | null = null;
  private history: BackfillJobDto[] = [];

  isRunning(): boolean {
    return this.current?.status === 'RUNNING';
  }

  get(): BackfillJobDto | null {
    return this.current;
  }

  recent(): BackfillJobDto[] {
    return this.history.slice(-10);
  }

  start(type: BackfillJobDto['type'], fromDate: string, toDate: string, total: number): BackfillJobDto {
    if (this.isRunning()) throw new Error(`Another job (${this.current!.type}) is already running`);
    this.current = {
      id: randomUUID(),
      type,
      status: 'RUNNING',
      fromDate,
      toDate,
      processed: 0,
      total,
      currentDate: null,
      message: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    return this.current;
  }

  progress(processed: number, currentDate: string | null, message?: string) {
    if (!this.current) return;
    this.current.processed = processed;
    this.current.currentDate = currentDate;
    if (message !== undefined) this.current.message = message;
  }

  finish(message?: string) {
    if (!this.current) return;
    this.current.status = 'COMPLETED';
    this.current.finishedAt = new Date().toISOString();
    if (message) this.current.message = message;
    this.history.push(this.current);
  }

  fail(err: unknown) {
    if (!this.current) return;
    this.current.status = 'FAILED';
    this.current.finishedAt = new Date().toISOString();
    this.current.message = err instanceof Error ? err.message : String(err);
    this.history.push(this.current);
  }
}
