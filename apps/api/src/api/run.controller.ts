import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BackfillJobDto, DailyRunResultDto } from '@nse/shared';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { DailyRunService } from '../engine/daily-run.service.js';
import { JobsService } from '../engine/jobs.service.js';

class RunDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsBoolean() ingest?: boolean;
}

@ApiTags('run')
@Controller('run')
export class RunController {
  constructor(
    private readonly daily: DailyRunService,
    private readonly jobs: JobsService,
  ) {}

  @Post('daily')
  @ApiOperation({ summary: 'Execute the end-of-day pipeline for a date (default: latest data)' })
  async runDaily(@Body() body: RunDto): Promise<DailyRunResultDto> {
    if (this.jobs.isRunning()) throw new BadRequestException(`A ${this.jobs.get()!.type} job is running — wait for it to finish`);
    try {
      return await this.daily.run(body?.date, body?.ingest ?? true);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Re-evaluate all OPEN live predictions against the latest bars' })
  async evaluate() {
    const updated = await this.daily.evaluateOpen();
    return { updated };
  }

  @Get('job')
  job(): { current: BackfillJobDto | null; recent: BackfillJobDto[] } {
    return { current: this.jobs.get(), recent: this.jobs.recent() };
  }
}
