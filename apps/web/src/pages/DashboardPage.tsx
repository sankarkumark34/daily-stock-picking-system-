import type { SectorStrengthDto } from '@nse/shared'
import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Badge, Button, Callout, Card, EmptyState, ProgressBar, Skeleton, StatTile, Term, fadeUp, staggerList } from '../components/ui'
import { useDataStatus, useMarketOverview, usePerformance, usePicks } from '../lib/api'
import { dateLong, fmt, pct, regimeLabel, regimeTone } from '../lib/format'
import { PicksTable } from './PicksPage'

export function DashboardPage() {
  const { data: overview, isLoading: ovLoading, error: ovError } = useMarketOverview()
  const { data: picks } = usePicks()
  const { data: perf } = usePerformance()
  const { data: status } = useDataStatus()

  if (ovLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
        <Skeleton className="h-96 md:col-span-4" />
      </div>
    )
  }

  if (!overview) {
    return (
      <EmptyState
        title="The model has not run yet"
        body={
          status?.lastDate
            ? `Market data is loaded through ${dateLong(status.lastDate)}. Run the daily pipeline to generate today's regime, sector strength and picks.`
            : 'No market data yet. Start a backfill from the Data page, then run the daily pipeline.'
        }
        action={
          <Link to="/data">
            <Button>
              Go to Data <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
    )
  }

  const nifty = overview.nifty
  const windows = perf?.windows ?? []
  const w = (label: string) => windows.find((x) => x.label === label)

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Market Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">As of close {dateLong(overview.date)} · {overview.universeSize} liquid stocks analysed</p>
        </div>
        <Link to="/picks" className="text-sm font-medium text-brand-700 hover:underline">
          View all picks →
        </Link>
      </div>
      {ovError && <Callout tone="danger">{(ovError as Error).message}</Callout>}

      <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Market regime"
          tip="marketRegime"
          value={<Badge tone={regimeTone(overview.regime)} size="md" className="text-sm">{regimeLabel(overview.regime)}</Badge>}
          sub={`Regime score ${fmt(overview.regimeScore, 0)}/100 · long bias ×${overview.longBias}`}
        />
        <StatTile
          label="NIFTY 50"
          tip="nifty"
          value={nifty.close.toLocaleString('en-IN')}
          tone={nifty.changePct >= 0 ? 'success' : 'danger'}
          sub={
            <span className="flex gap-2">
              <span>{pct(nifty.changePct, 2, true)} today</span>
              <span>·</span>
              <span>{pct(nifty.ret20, 1, true)} 20d</span>
            </span>
          }
        />
        <StatTile
          label="India VIX"
          tip="vix"
          value={overview.vix ? fmt(overview.vix.close, 2) : '–'}
          tone={overview.volatilityRegime === 'HIGH' ? 'danger' : overview.volatilityRegime === 'LOW' ? 'success' : 'neutral'}
          sub={overview.vix ? `${overview.volatilityRegime.toLowerCase()} volatility · 60d avg ${fmt(overview.vix.avg60, 1)}` : 'not available'}
        />
        <StatTile
          label="Breadth"
          tip="breadth"
          value={`${overview.breadth.advances} / ${overview.breadth.declines}`}
          tone={overview.breadth.advanceDeclineRatio >= 1 ? 'success' : 'danger'}
          sub={`A/D ${fmt(overview.breadth.advanceDeclineRatio, 2)} · ${fmt(overview.breadth.pctAboveSma50, 0)}% above 50-SMA`}
        />
      </motion.div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card title="Today's top picks" subtitle="Click a row for the trade plan and factor breakdown" padded={false} action={<Link to="/picks" className="text-xs font-medium text-brand-700 hover:underline">Full list</Link>}>
          {picks?.picks.length ? (
            <PicksTable picks={picks.picks} compact />
          ) : (
            <div className="p-5">
              <EmptyState title="No stock cleared the quality bar" body="The system does not force a list. When fewer than 10 setups meet the minimum score, it outputs fewer — today it found none." />
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title={<Term k="sectorStrength">Sector strength</Term>} subtitle="Equal-weighted constituents · relative to NIFTY">
            <SectorList sectors={overview.sectors} />
          </Card>
          <Card title={<Term k="hitRate">Model performance</Term>} subtitle="Live picks · target hit before stop">
            <div className="grid grid-cols-3 gap-3">
              {(['7 days', '30 days', '90 days'] as const).map((l) => {
                const x = w(l)
                return (
                  <div key={l} className="rounded-lg border border-ink-100 bg-ink-50/60 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{l}</p>
                    <p className={clsx('mt-1 text-xl font-semibold tnum', x?.hitRate !== null && x?.hitRate !== undefined ? (x.hitRate >= 60 ? 'text-up-700' : x.hitRate >= 45 ? 'text-warn-700' : 'text-down-700') : 'text-ink-400')}>
                      {x?.hitRate !== null && x?.hitRate !== undefined ? `${fmt(x.hitRate, 0)}%` : '–'}
                    </p>
                    <p className="text-[11px] text-ink-500">{x ? `${x.success}/${x.success + x.failure + x.expired} closed · ${x.open} open` : '–'}</p>
                  </div>
                )
              })}
            </div>
            <Link to="/performance" className="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline">
              Full analytics →
            </Link>
          </Card>
        </div>
      </div>

      <Card title="Regime notes" className="mt-5">
        <ul className="grid gap-2 text-sm text-ink-700 md:grid-cols-2">
          {overview.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
              {n}
            </li>
          ))}
          <li className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
            {overview.breadth.newHighs20} stocks made new 20-day highs, {overview.breadth.newLows20} made new 20-day lows; {fmt(overview.breadth.pctAboveSma200, 0)}% trade above their 200-SMA.
          </li>
        </ul>
      </Card>
    </>
  )
}

export function SectorList({ sectors, limit = 12 }: { sectors: SectorStrengthDto[]; limit?: number }) {
  const list = sectors.slice(0, limit)
  return (
    <motion.ul variants={staggerList} initial="hidden" animate="show" className="space-y-2.5">
      {list.map((s) => (
        <motion.li key={s.sector} variants={fadeUp} className="grid grid-cols-[minmax(0,1fr)_120px_56px] items-center gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">
              <span className="mr-1.5 text-ink-400 tnum">{s.rank}.</span>
              {s.sector}
            </p>
            <p className="text-[11px] text-ink-500">
              {s.constituents} stocks · RS {pct(s.relativeStrength20, 1, true)} · {fmt(s.breadthAboveEma21, 0)}% above EMA21
            </p>
          </div>
          <ProgressBar value={s.score} tone={s.score >= 60 ? 'success' : s.score >= 45 ? 'info' : 'danger'} />
          <span className="num font-semibold">{fmt(s.score, 0)}</span>
        </motion.li>
      ))}
    </motion.ul>
  )
}
