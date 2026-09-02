import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { FactorScore } from '@nse/shared';

/**
 * Every pick the system ever produced, permanently stored with its levels and
 * the eventual outcome. Live picks have runId = null; backtest picks carry the run id.
 */
@Entity('predictions')
@Index(['date'])
@Index(['symbol'])
@Index(['runId'])
@Index(['outcome'])
export class PredictionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'integer' })
  rank: number;

  @Column({ type: 'varchar', length: 32 })
  symbol: string;

  @Column({ type: 'varchar', length: 80 })
  sector: string;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'varchar', length: 10 })
  direction: string;

  @Column({ type: 'varchar', length: 24 })
  setup: string;

  @Column({ type: 'float', nullable: true })
  setupSuccessRate: number | null;

  @Column({ type: 'varchar', length: 20 })
  regime: string;

  @Column({ type: 'float' }) entry: number;
  @Column({ type: 'float' }) entryLow: number;
  @Column({ type: 'float' }) entryHigh: number;
  @Column({ type: 'float' }) target: number;
  @Column({ type: 'float' }) stopLoss: number;
  @Column({ type: 'float' }) riskReward: number;
  @Column({ type: 'float' }) riskPct: number;
  @Column({ type: 'float' }) rewardPct: number;
  @Column({ type: 'integer' }) holdDays: number;

  @Column({ type: 'simple-json' })
  reasons: string[];

  @Column({ type: 'simple-json' })
  factors: FactorScore[];

  @Column({ type: 'varchar', length: 10, default: 'OPEN' })
  outcome: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  outcomeDate: string | null;

  @Column({ type: 'float', nullable: true })
  fillPrice: number | null;

  @Column({ type: 'float', nullable: true })
  exitPrice: number | null;

  @Column({ type: 'float', nullable: true })
  grossReturnPct: number | null;

  @Column({ type: 'float', nullable: true })
  netReturnPct: number | null;

  @Column({ type: 'integer', nullable: true })
  daysHeld: number | null;

  @Column({ type: 'integer', nullable: true })
  runId: number | null;

  @Column({ type: 'varchar', length: 30 })
  createdAt: string;
}
