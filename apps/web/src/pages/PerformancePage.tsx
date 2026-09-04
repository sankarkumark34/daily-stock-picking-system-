import type { GroupStatsDto } from '@nse/shared'
import clsx from 'clsx'
import { useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Callout, Card, EmptyState, PageHeader, Select, Skeleton, Term } from '../components/ui'
import { useBacktestRuns, usePerformance } from '../lib/api'
import { dateShort, fmt, pct, regimeLabel, setupLabel } from '../lib/format'

export function PerformancePage() {
  const [params, setParams] = useSearchParams()
  const runId = params.get('runId') ? Number(params.get('runId')) : null
  const { data, isLoading, error } = usePerformance(runId)
  const { data: runs } = useBacktestRuns()

  return (
    <>
      <PageHeader
        title="Model Performance"
        description="Every pick is stored with its entry, target and stop. Success = target touched before stop within the holding period. Returns are net of brokerage, STT, exchange charges, GST, stamp duty and slippage."
        actions={
          <Select
            value={runId ?? ''}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('runId', e.target.value)
              else next.delete('runId')
              setParams(next, { replace: true })
            }}
            aria-label="Source"
          >
            <option value="">Live picks</option>
            {runs?.filter((r) => r.status === 'COMPLETED').map((r) => (
              <option key={r.id} value={r.id}>
                Backtest #{r.id} · {r.label}
              </option>
            ))}
          </Select>
        }
      />
      {error && <Callout tone="danger">{(error as Error).message}</Callout>}
      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : data.windows.every((w) => w.picks === 0) ? (
        <EmptyState title="No predictions recorded yet" body="Run the daily pipeline for a few sessions (or run a backtest) and outcomes will appear here as targets and stops are resolved." />
      ) : (
        <div className="space-y-5">
          <Card title="Hit rate by window" subtitle={`As of ${dateShort(data.asOf)}`} padded={false}>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th className="text-right">Picks</th>
                    <th className="text-right">Closed</th>
                    <th className="text-right">Target hit</th>
                    <th className="text-right">Stop hit</th>
                    <th className="text-right"><Term k="expired">Expired</Term></th>
                    <th className="text-right">Open</th>
                    <th className="text-right"><Term k="hitRate">Hit rate</Term></th>
                    <th className="text-right"><Term k="directionalAccuracy">Positive %</Term></th>
                    <th className="text-right"><Term k="netReturn">Avg net</Term></th>
                    <th className="text-right"><Term k="profitFactor">Profit factor</Term></th>
                  </tr>
                </thead>
                <tbody>
                  {data.windows.map((w) => (
                    <tr key={w.label}>
                      <td className="font-medium">{w.label}</td>
                      <td className="num">{w.picks}</td>
                      <td className="num">{w.success + w.failure + w.expired}</td>
                      <td className="num text-up-700">{w.success}</td>
                      <td className="num text-down-700">{w.failure}</td>
                      <td className="num text-warn-700">{w.expired}</td>
                      <td className="num text-ink-500">{w.open}</td>
                      <td className={clsx('num font-semibold', rateTone(w.hitRate))}>{w.hitRate === null ? '–' : `${fmt(w.hitRate, 1)}%`}</td>
                      <td className="num">{w.directionalAccuracy === null ? '–' : `${fmt(w.directionalAccuracy, 1)}%`}</td>
                      <td className={clsx('num', w.avgNetReturnPct !== null && (w.avgNetReturnPct >= 0 ? 'text-up-700' : 'text-down-700'))}>{pct(w.avgNetReturnPct, 2, true)}</td>
                      <td className="num">{fmt(w.profitFactor, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Daily outcomes" subtitle="Per selection date · resolved picks only">
            <DailyOutcomesChart daily={data.daily} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <GroupTable title="By market regime" rows={data.byRegime} labelFn={regimeLabel} />
            <GroupTable title="By setup" rows={data.bySetup} labelFn={setupLabel} />
          </div>
        </div>
      )}
    </>
  )
}

export const rateTone = (v: number | null) => (v === null ? 'text-ink-400' : v >= 60 ? 'text-up-700' : v >= 45 ? 'text-warn-700' : 'text-down-700')

export function GroupTable({ title, rows, labelFn }: { title: string; rows: GroupStatsDto[]; labelFn?: (k: string) => string }) {
  return (
    <Card title={title} padded={false}>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Group</th>
              <th className="text-right">Trades</th>
              <th className="text-right"><Term k="hitRate">Hit rate</Term></th>
              <th className="text-right"><Term k="directionalAccuracy">Positive %</Term></th>
              <th className="text-right"><Term k="expectancy">Expectancy</Term></th>
              <th className="text-right"><Term k="profitFactor">Profit factor</Term></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-ink-500">
                  No closed trades yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="font-medium">{labelFn ? labelFn(r.key) : r.key}</td>
                <td className="num">{r.trades}</td>
                <td className={clsx('num font-semibold', rateTone(r.hitRate))}>{r.hitRate === null ? '–' : `${fmt(r.hitRate, 1)}%`}</td>
                <td className="num">{r.directionalAccuracy === null ? '–' : `${fmt(r.directionalAccuracy, 1)}%`}</td>
                <td className={clsx('num', r.expectancyPct !== null && (r.expectancyPct >= 0 ? 'text-up-700' : 'text-down-700'))}>{pct(r.expectancyPct, 2, true)}</td>
                <td className="num">{fmt(r.profitFactor, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function DailyOutcomesChart({ daily }: { daily: { date: string; success: number; failure: number; expired: number }[] }) {
  const rows = daily.slice(-120)
  if (!rows.length) return <p className="text-sm text-ink-500">No resolved picks yet.</p>
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={28} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip labelFormatter={(l) => dateShort(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="success" name="Target hit" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
          <Bar dataKey="expired" name="Expired" stackId="a" fill="#f59e0b" />
          <Bar dataKey="failure" name="Stop hit" stackId="a" fill="#e11d48" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
