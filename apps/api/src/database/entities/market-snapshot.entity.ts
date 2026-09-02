import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { MarketOverviewDto } from '@nse/shared';

/** One row per trading day: regime + breadth + sector strengths as computed on that day. */
@Entity('market_snapshots')
export class MarketSnapshotEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  regime: string;

  @Column({ type: 'varchar', length: 10 })
  volatilityRegime: string;

  @Column({ type: 'float' })
  regimeScore: number;

  @Column({ type: 'float' })
  longBias: number;

  @Column({ type: 'float', nullable: true })
  niftyClose: number | null;

  @Column({ type: 'float', nullable: true })
  vixClose: number | null;

  @Column({ type: 'simple-json' })
  overview: MarketOverviewDto;

  @Column({ type: 'boolean', default: false })
  isBacktest: boolean;
}
