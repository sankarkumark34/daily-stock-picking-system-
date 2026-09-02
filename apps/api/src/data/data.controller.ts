import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DataStatusDto } from '@nse/shared';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { DataService } from './data.service.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class IngestDto {
  @IsString() @Matches(DATE_RE) date: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

class BackfillDto {
  @IsString() @Matches(DATE_RE) fromDate: string;
  @IsString() @Matches(DATE_RE) toDate: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

@ApiTags('data')
@Controller('data')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('status')
  @ApiOperation({ summary: 'Database coverage, last ingested date and recent ingest logs' })
  status(): Promise<DataStatusDto> {
    return this.data.status();
  }

  @Post('universe/sync')
  @ApiOperation({ summary: 'Refresh the Nifty 500 constituent list (sector mapping)' })
  async syncUniverse() {
    const n = await this.data.syncUniverse();
    return { mapped: n };
  }

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest one trading date from the data provider' })
  async ingest(@Body() body: IngestDto) {
    const rows = await this.data.ingestDate(body.date, body.force ?? false);
    return { date: body.date, rows };
  }

  @Post('backfill')
  @ApiOperation({ summary: 'Start a background backfill for a date range' })
  backfill(@Body() body: BackfillDto) {
    if (body.fromDate > body.toDate) throw new BadRequestException('fromDate must be <= toDate');
    try {
      const jobId = this.data.startBackfill(body.fromDate, body.toDate, body.force ?? false);
      return { jobId };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
