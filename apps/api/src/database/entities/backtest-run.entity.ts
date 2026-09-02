import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  BacktestDiagnostics,
  BacktestMetrics,
  BacktestParams,
  DailyHitRatePoint,
  EquityPoint,
  GroupStatsDto,
  RollingHitRatePoint,
  WalkForwardSplitResult,
} from '@nse/shared';

@Entity('backtest_runs')
export class BacktestRunEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 12 })
  status: string;

  @Column({ type: 'varchar', length: 30 })
  createdAt: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  finishedAt: string | null;

  @Column({ type: 'simple-json' })
  params: BacktestParams;

  @Column({ type: 'simple-json', nullable: true })
  metrics: BacktestMetrics | null;

  @Column({ type: 'simple-json', nullable: true })
  byRegime: GroupStatsDto[] | null;

  @Column({ type: 'simple-json', nullable: true })
  bySetup: GroupStatsDto[] | null;

  @Column({ type: 'simple-json', nullable: true })
  byYear: GroupStatsDto[] | null;

  @Column({ type: 'simple-json', nullable: true })
  daily: DailyHitRatePoint[] | null;

  @Column({ type: 'simple-json', nullable: true })
  equity: EquityPoint[] | null;

  @Column({ type: 'simple-json', nullable: true })
  rolling: RollingHitRatePoint[] | null;

  @Column({ type: 'simple-json', nullable: true })
  walkForward: WalkForwardSplitResult[] | null;

  @Column({ type: 'simple-json', nullable: true })
  diagnostics: BacktestDiagnostics | null;

  @Column({ type: 'text', nullable: true })
  verdict: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'float', default: 0 })
  progress: number;
}
