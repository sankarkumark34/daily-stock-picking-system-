import type { BacktestMetrics, BacktestParams, BacktestRunDto } from '@nse/shared'
import { FACTOR_LABELS, FACTOR_NAMES } from '@nse/shared'
import clsx from 'clsx'
import { Play, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Callout, Card, EmptyState, Field, Input, PageHeader, ProgressBar, Skeleton, StatTile, Term, Toggle, fadeUp, staggerList } from '../components/ui'
import { useBacktestDefaults, useBacktestRun, useBacktestRuns, useDeleteBacktest, useStartBacktest } from '../lib/api'
import { dateShort, fmt, pct, regimeLabel, setupLabel, timeAgo } from '../lib/format'
import { DailyOutcomesChart, GroupTable, rateTone } from './PerformancePage'

export function BacktestPage() {
  const { id } = useParams()
  const selected = id ? Number(id) : null
  const { data: runs, isLoading } = useBacktestRuns()
  const { data: run } = useBacktestRun(selected)
  const del = useDeleteBacktest()
  const nav = useNavigate()

  return (
    <>
      <PageHeader
        title="Backtesting"
        description="Point-in-time replay of the full pipeline. Only data available on each historical date is used; outcomes are then measured against the bars that followed, net of trading costs."
      />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <NewRunForm />
          <Card title="Runs" padded={false}>
            {isLoading ? (
              <Skeleton className="m-4 h-24" />
            ) : !runs?.length ? (
              <div className="p-4">
                <EmptyState title="No backtests yet" body="Configure a run on the left. A 5-year run over the full NSE universe takes a few minutes." />
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link to={`/backtest/${r.id}`} className={clsx('flex items-start justify-between gap-2 px-4 py-3 text-sm hover:bg-brand-50/50', selected === r.id && 'bg-brand-50/70')}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          #{r.id} · {r.label}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {dateShort(r.fromDate)} → {dateShort(r.toDate)} · {timeAgo(r.createdAt)}
                        </p>
                        {r.status === 'RUNNING' && <ProgressBar value={r.progress} className="mt-2 w-40" />}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={r.status === 'COMPLETED' ? 'success' : r.status === 'FAILED' ? 'danger' : 'info'}>{r.status.toLowerCase()}</Badge>
                        {r.winRate !== null && <span className={clsx('text-xs tnum font-medium', rateTone(r.winRate))}>{fmt(r.winRate, 1)}% hit</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {selected === null ? (
            <EmptyState title="Select a run" body="Pick a run from the list, or start a new one, to see its metrics, equity curve and walk-forward splits." />
          ) : !run ? (
            <Skeleton className="h-96" />
          ) : (
            <RunDetail
              run={run}
              onDelete={async () => {
                if (!confirm(`Delete backtest #${run.id} and its stored picks?`)) return
                await del.mutateAsync(run.id)
                nav('/backtest')
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

function NewRunForm() {
  const { data: defaults } = useBacktestDefaults()
  const start = useStartBacktest()
  const nav = useNavigate()
  const [form, setForm] = useState<Partial<BacktestParams>>({})
  const [showWeights, setShowWeights] = useState(false)
  useEffect(() => {
    if (defaults && !form.fromDate) setForm({ ...defaults, label: '' })
  }, [defaults, form.fromDate])
  if (!defaults || !form.weights) return <Skeleton className="h-64" />
  const upd = <K extends keyof BacktestParams>(k: K, v: BacktestParams[K]) => setForm((f) => ({ ...f, [k]: v }))
  const weightSum = FACTOR_NAMES.reduce((a, k) => a + (form.weights?.[k] ?? 0), 0)

  return (
    <Card title="New backtest" subtitle="Rule-based model · long only">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const res = await start.mutateAsync(form)
          nav(`/backtest/${res.id}`)
        }}
      >
        <Field label="Label">
          <Input value={form.label ?? ''} onChange={(e) => upd('label', e.target.value)} placeholder="e.g. Baseline 2019–2025" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input type="date" value={form.fromDate} onChange={(e) => upd('fromDate', e.target.value)} required />
          </Field>
          <Field label="To">
            <Input type="date" value={form.toDate} onChange={(e) => upd('toDate', e.target.value)} required />
          </Field>
          <Field label="Max picks / day">
            <Input type="number" min={1} max={20} value={form.maxPicks} onChange={(e) => upd('maxPicks', Number(e.target.value))} />
          </Field>
          <Field label="Min score">
            <Input type="number" min={0} max={100} value={form.minScore} onChange={(e) => upd('minScore', Number(e.target.value))} />
          </Field>
          <Field label="Hold days" hint="0 = per-setup default">
            <Input type="number" min={0} max={30} value={form.holdDays} onChange={(e) => upd('holdDays', Number(e.target.value))} />
          </Field>
          <Field label="Max per sector">
            <Input type="number" min={1} max={10} value={form.maxPerSector} onChange={(e) => upd('maxPerSector', Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Toggle checked={!!form.walkForward} onChange={(v) => upd('walkForward', v)} label="Walk-forward splits (train → validate → test by year)" />
          <Toggle checked={!!form.optimizeWeights} onChange={(v) => upd('optimizeWeights', v)} label="Optimise weights on train window only" />
          <Toggle checked={showWeights} onChange={setShowWeights} label="Edit factor weights" />
        </div>
        {showWeights && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
            {FACTOR_NAMES.map((k) => (
              <Field key={k} label={FACTOR_LABELS[k]}>
                <Input type="number" min={0} max={100} value={form.weights![k]} onChange={(e) => upd('weights', { ...form.weights!, [k]: Number(e.target.value) })} />
              </Field>
            ))}
            <p className={clsx('col-span-2 text-xs', Math.round(weightSum) === 100 ? 'text-ink-500' : 'text-warn-700')}>Sum {weightSum} — normalised to 100 automatically.</p>
          </div>
        )}
        {start.error && <Callout tone="danger">{(start.error as Error).message}</Callout>}
        <Button type="submit" loading={start.isPending} className="w-full">
          <Play size={14} /> Run backtest
        </Button>
      </form>
    </Card>
  )
}

function RunDetail({ run, onDelete }: { run: BacktestRunDto; onDelete: () => void }) {
  const m = run.metrics
  if (run.status === 'FAILED') return <Callout tone="danger" title="Backtest failed">{run.error}</Callout>
  if (run.status !== 'COMPLETED' || !m) {
    return (
      <Card title={`#${run.id} · ${run.label}`} subtitle="Running the pipeline over every historical date…">
        <ProgressBar value={run.progress} />
        <p className="mt-2 text-sm text-ink-500">{run.progress}% — analysing universe, evaluating outcomes, then walk-forward splits.</p>
      </Card>
    )
  }
  const verdictTone = (m.expectancyPct ?? 0) <= 0 || (m.profitFactor ?? 0) < 1 ? 'danger' : (m.profitFactor ?? 0) < 1.2 ? 'warning' : 'success'
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            #{run.id} · {run.label}
          </h2>
          <p className="text-sm text-ink-500">
            {dateShort(run.params.fromDate)} → {dateShort(run.params.toDate)} · {m.tradingDays} trading days · max {run.params.maxPicks} picks · min score {run.params.minScore} · round-trip cost {fmt(m.totalCostPct, 3)}%
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>

      <Callout tone={verdictTone} title="Verdict">
        {run.verdict}
      </Callout>

      <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Picks" tip="candidates" value={m.trades} sub={`${m.filled} filled · ${m.noFill} no-fill · ${fmt(m.avgPicksPerDay, 1)}/day`} />
        <StatTile label="Target-hit rate" tip="hitRate" value={m.winRate === null ? '–' : `${fmt(m.winRate, 1)}%`} tone={m.winRate !== null && m.winRate >= 55 ? 'success' : 'neutral'} sub={`stop ${fmt(m.stopHitRate, 1)}% · expired ${fmt(m.expiredRate, 1)}%`} />
        <StatTile label="Expectancy / trade" tip="expectancy" value={pct(m.expectancyPct, 2, true)} tone={(m.expectancyPct ?? 0) > 0 ? 'success' : 'danger'} sub={`avg win ${pct(m.avgWinPct, 2, true)} · avg loss ${pct(m.avgLossPct, 2)}`} />
        <StatTile label="Profit factor" tip="profitFactor" value={fmt(m.profitFactor, 2)} tone={(m.profitFactor ?? 0) >= 1.2 ? 'success' : (m.profitFactor ?? 0) >= 1 ? 'warning' : 'danger'} sub={`Sharpe ${fmt(m.sharpe, 2)} · Sortino ${fmt(m.sortino, 2)}`} />
        <StatTile label="Avg daily hit rate" tip="daysWith6of10" value={m.avgDailyHitRate === null ? '–' : `${fmt(m.avgDailyHitRate, 0)}%`} tone={(m.avgDailyHitRate ?? 0) >= 60 ? 'success' : 'warning'} sub={`${m.daysWith6PlusOf10} days with 6+ winners of 8–10`} />
        <StatTile label="Max drawdown" tip="maxDrawdown" value={pct(m.maxDrawdownPct, 1)} tone="danger" sub="fixed 1/N sizing, additive P&L" />
        <StatTile label="CAGR (model, annualised)" tip="cagr" value={pct(m.cagrPct, 1, true)} tone={(m.cagrPct ?? 0) > 0 ? 'success' : 'danger'} sub={`total ${pct(m.totalNetReturnPct, 1, true)}`} />
        <StatTile label="Avg holding" tip="holdDays" value={`${fmt(m.avgHoldingDays, 1)} d`} sub={`positive-return picks ${fmt(m.directionalAccuracy, 1)}%`} />
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<Term k="equity">Equity curve</Term>} subtitle="Start 100 · each pick risks 1/N of capital · net of costs">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={run.equity} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f5fe0" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2f5fe0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={40} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip labelFormatter={(l) => dateShort(String(l))} formatter={(v) => fmt(Number(v), 2)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <Area type="monotone" dataKey="equity" name="Equity" stroke="#2f5fe0" fill="url(#eq)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={<Term k="hitRate">Rolling hit rate</Term>} subtitle="Target-hit % over trailing windows">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={run.rolling} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip labelFormatter={(l) => dateShort(String(l))} formatter={(v) => `${fmt(Number(v), 1)}%`} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="hitRate30" name="30d" stroke="#94a3b8" dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="hitRate90" name="90d" stroke="#2f5fe0" dot={false} strokeWidth={1.6} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="hitRate365" name="1y" stroke="#059669" dot={false} strokeWidth={1.8} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Daily outcomes (last 120 selection days)">
        <DailyOutcomesChart daily={run.daily} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <GroupTable title="By year" rows={run.byYear} />
        <GroupTable title="By market regime" rows={run.byRegime} labelFn={regimeLabel} />
        <GroupTable title="By setup" rows={run.bySetup} labelFn={setupLabel} />
      </div>

      {run.walkForward.length > 0 && (
        <Card title={<Term k="walkForward">Walk-forward validation</Term>} subtitle="Anchored yearly splits. The test column is the only out-of-sample number — trust that one." padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Split</th>
                  <th className="text-right">Train hit</th>
                  <th className="text-right">Train exp.</th>
                  <th className="text-right">Validate hit</th>
                  <th className="text-right">Validate exp.</th>
                  <th className="text-right">Test trades</th>
                  <th className="text-right">Test hit</th>
                  <th className="text-right">Test exp.</th>
                  <th className="text-right">Test PF</th>
                  {run.params.optimizeWeights && <th className="text-right">Baseline test exp.</th>}
                </tr>
              </thead>
              <tbody>
                {run.walkForward.map((s) => (
                  <tr key={s.label}>
                    <td className="font-medium">{s.label}</td>
                    <Cells m={s.train.metrics} />
                    <Cells m={s.validate.metrics} />
                    <td className="num">{s.test.metrics?.trades ?? '–'}</td>
                    <td className={clsx('num font-semibold', rateTone(s.test.metrics?.winRate ?? null))}>{s.test.metrics?.winRate == null ? '–' : `${fmt(s.test.metrics.winRate, 1)}%`}</td>
                    <td className={clsx('num font-semibold', (s.test.metrics?.expectancyPct ?? 0) >= 0 ? 'text-up-700' : 'text-down-700')}>{pct(s.test.metrics?.expectancyPct, 2, true)}</td>
                    <td className="num">{fmt(s.test.metrics?.profitFactor, 2)}</td>
                    {run.params.optimizeWeights && <td className="num text-ink-500">{pct(s.baselineTestMetrics?.expectancyPct, 2, true)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {run.params.optimizeWeights && (
            <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
              Weights chosen per split (train-only optimisation, accepted only if validation improved):{' '}
              {run.walkForward.map((s) => (
                <span key={s.label} className="mr-3 inline-block">
                  <strong>{s.test.from.slice(0, 4)}:</strong> {FACTOR_NAMES.map((k) => `${FACTOR_LABELS[k].split(' ')[0]} ${s.weights[k]}`).join(' · ')}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}
      {run.diagnostics && (
        <Card title={<Term k="candidates">Pipeline diagnostics</Term>} subtitle="Why the run produced what it did">
          <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Universe</p>
              <p className="mt-1 tnum">{run.diagnostics.avgUniverseSize} liquid stocks / day</p>
              <p className="text-xs text-ink-500">{run.diagnostics.analysedDays} days analysed</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Candidates with a setup</p>
              <p className="mt-1 tnum">{run.diagnostics.avgCandidatesPerDay} / day</p>
              <p className="text-xs text-ink-500">
                {Object.entries(run.diagnostics.candidatesBySetup)
                  .map(([k, v]) => `${setupLabel(k)} ${v}`)
                  .join(' · ')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Selected by setup</p>
              <p className="mt-1 text-xs text-ink-700">
                {Object.entries(run.diagnostics.selectedBySetup)
                  .map(([k, v]) => `${setupLabel(k)} ${v}`)
                  .join(' · ') || '–'}
              </p>
              <p className="text-xs text-ink-500">{run.diagnostics.daysWithFewerThanMax} days with fewer than {run.params.maxPicks} picks</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Selected score spread</p>
              {run.diagnostics.selectedScore ? (
                <p className="mt-1 tnum text-xs text-ink-700">
                  min {fmt(run.diagnostics.selectedScore.min, 1)} · p25 {fmt(run.diagnostics.selectedScore.p25, 1)} · median {fmt(run.diagnostics.selectedScore.median, 1)} · p75 {fmt(run.diagnostics.selectedScore.p75, 1)} · max {fmt(run.diagnostics.selectedScore.max, 1)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-500">no picks</p>
              )}
              <p className="text-xs text-ink-500">
                Regime days:{' '}
                {Object.entries(run.diagnostics.regimeDays)
                  .map(([k, v]) => `${regimeLabel(k)} ${v}`)
                  .join(' · ')}
              </p>
            </div>
          </div>
        </Card>
      )}
      <motion.p variants={fadeUp} initial="hidden" animate="show" className="text-xs text-ink-500">
        Caveats: sector mapping uses the current Nifty 500 list (survivorship bias in sector strength only — the stock universe itself is point-in-time from daily bhavcopy). Fundamentals are neutral (no point-in-time source). Fills assume next-day open with 0.05% slippage per side.
      </motion.p>
    </div>
  )
}

function Cells({ m }: { m: BacktestMetrics | null }) {
  return (
    <>
      <td className={clsx('num', rateTone(m?.winRate ?? null))}>{m?.winRate == null ? '–' : `${fmt(m.winRate, 1)}%`}</td>
      <td className={clsx('num', (m?.expectancyPct ?? 0) >= 0 ? 'text-up-700' : 'text-down-700')}>{pct(m?.expectancyPct, 2, true)}</td>
    </>
  )
}
