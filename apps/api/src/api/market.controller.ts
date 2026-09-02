import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { MarketOverviewDto } from '@nse/shared';
import { Repository } from 'typeorm';
import { MarketSnapshotEntity } from '../database/entities/market-snapshot.entity.js';

@ApiTags('market')
@Controller('market')
export class MarketController {
  constructor(@InjectRepository(MarketSnapshotEntity) private readonly snapshots: Repository<MarketSnapshotEntity>) {}

  @Get('overview')
  @ApiOperation({ summary: 'Market regime, breadth and sector strength for a date (default: latest)' })
  async overview(@Query('date') date?: string): Promise<MarketOverviewDto> {
    const row = date
      ? await this.snapshots.findOne({ where: { date } })
      : await this.snapshots.findOne({ where: {}, order: { date: 'DESC' } });
    if (!row) throw new NotFoundException(date ? `No market snapshot for ${date}` : 'No market snapshot yet — run the daily pipeline first');
    return row.overview;
  }

  @Get('dates')
  async dates(): Promise<string[]> {
    const rows = await this.snapshots.find({ select: { date: true }, order: { date: 'DESC' }, take: 400 });
    return rows.map((r) => r.date);
  }
}
