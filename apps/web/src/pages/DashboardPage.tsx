import type { SectorStrengthDto } from '@nse/shared'
import clsx from 'clsx'
import { ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Button, Callout, Card, EmptyState, InsightBanner, PageHeader, Skeleton, StatTile, Term, fadeUp, staggerList } from '../components/ui'
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
  const rTone = regimeTone(overview.regime)

  return (
    <>
      {/* ── Page Heading (Design Spec §6.3) ── */}
      <PageHeader
        eyebrow="QUANTITATIVE MARKET INTELLIGENCE"
        title="Market Dashboard"
        description={`As of close ${dateLong(overview.date)} · ${overview.universeSize} liquid stocks analysed · Delayed ~15 min feed`}
        actions={
          <Link
            to="/picks"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7046E8] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#6234DC] transition-colors"
          >
            View all picks <ArrowRight size={13} />
          </Link>
        }
      />

      {ovError && <Callout tone="danger">{(ovError as Error).message}</Callout>}

      {/* ── Insight Banner (Design Spec §6.8) ── */}
      <InsightBanner
        className="mb-5"
        icon={<Sparkles size={18} />}
        title={`${regimeLabel(overview.regime)} Regime Confirmed (Score ${fmt(overview.regimeScore, 0)}/100 · Long Bias ×${overview.longBias})`}
        message={
          rTone === 'success'
            ? `Market breadth is expansive with A/D ratio at ${fmt(overview.breadth.advanceDeclineRatio, 2)} and ${fmt(overview.breadth.pctAboveSma50, 0)}% of universe stocks trading above 50-SMA. Prioritize top-ranked momentum breakouts while keeping stops disciplined.`
            : rTone === 'danger'
              ? `Defensive stance recommended. Capital preservation is priority under elevated volatility. Avoid fresh swing longs without confirmed reversal volume.`
              : `Selective market rotation underway. Equal-weighted sectors displaying selective leadership. Calibrate position sizes to 50% standard risk.`
        }
        action={
          <Link
            to="/picks"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#7046E8] bg-white px-3.5 py-1.5 text-xs font-bold text-[#7046E8] hover:bg-[#F0EBFF] shadow-2xs transition-colors"
          >
            Explore Setups <ArrowRight size={13} />
          </Link>
        }
      />

      {/* ── Market Metric Cards (Design Spec §6.4: 4 variants with hover lift) ── */}
      <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Market Regime"
          tip="marketRegime"
          value={<span className="font-extrabold">{regimeLabel(overview.regime)}</span>}
          tone={rTone}
          sub={`Regime score ${fmt(overview.regimeScore, 0)}/100 · Long bias ×${overview.longBias}`}
        />
        <StatTile
          label="NIFTY 50 Index"
          tip="nifty"
          value={nifty.close.toLocaleString('en-IN')}
          tone={nifty.changePct >= 0 ? 'success' : 'danger'}
          sub={
            <span className="flex items-center gap-1.5 font-medium">
              <span className={nifty.changePct >= 0 ? 'text-[#079B73] font-bold' : 'text-[#D9234F] font-bold'}>
                {pct(nifty.changePct, 2, true)} today
              </span>
              <span>·</span>
              <span>{pct(nifty.ret20, 1, true)} 20-day return</span>
            </span>
          }
        />
        <StatTile
          label="India VIX (Volatility)"
          tip="vix"
          value={overview.vix ? fmt(overview.vix.close, 2) : '–'}
          tone={overview.volatilityRegime === 'HIGH' ? 'danger' : overview.volatilityRegime === 'LOW' ? 'success' : 'warning'}
          sub={overview.vix ? `${overview.volatilityRegime.toLowerCase()} volatility · 60d avg ${fmt(overview.vix.avg60, 1)}` : 'Market calm'}
        />
        <StatTile
          label="Market Breadth"
          tip="breadth"
          value={`${overview.breadth.advances} / ${overview.breadth.declines}`}
          tone={overview.breadth.advanceDeclineRatio >= 1 ? 'success' : 'danger'}
          sub={`A/D ratio ${fmt(overview.breadth.advanceDeclineRatio, 2)} · ${fmt(overview.breadth.pctAboveSma50, 0)}% > 50-SMA`}
        />
      </motion.div>

      {/* ── Main Dashboard Layout (§5.1: Flexible picks table + 230–260px sector panel) ── */}
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_260px]">
        {/* Left: Top Picks Decision Surface (§6.5) */}
        <Card
          title="Today's Top Picks"
          subtitle="Click any row to expand full trade plan, stop/target levels and factor weights"
          padded={false}
          action={<Link to="/picks" className="text-xs font-bold text-[#7046E8] hover:underline">View Full List →</Link>}
        >
          {picks?.picks.length ? (
            <PicksTable picks={picks.picks} compact />
          ) : (
            <div className="p-6">
              <EmptyState
                title="No stock cleared the quality bar"
                body="The system does not force a list. When fewer than 10 setups meet the minimum score, it outputs fewer — today it found none."
              />
            </div>
          )}
        </Card>

        {/* Right: Sector Strength Panel (Design Spec §6.7) */}
        <div className="space-y-5">
          <Card
            title={<Term k="sectorStrength">Sector Strength</Term>}
            subtitle="Relative to NIFTY 50"
          >
            <SectorList sectors={overview.sectors} />
          </Card>

          <Card
            title={<Term k="hitRate">Model Performance</Term>}
            subtitle="Live picks · Target hit before stop"
          >
            <div className="grid grid-cols-3 gap-2">
              {(['7 days', '30 days', '90 days'] as const).map((l) => {
                const x = w(l)
                return (
                  <div key={l} className="rounded-lg border border-[#DFE6F1] bg-[#F8FAFF] p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{l}</p>
                    <p className={clsx('mt-1 text-lg font-extrabold tnum', x?.hitRate !== null && x?.hitRate !== undefined ? (x.hitRate >= 60 ? 'text-[#079B73]' : x.hitRate >= 45 ? 'text-[#D88A00]' : 'text-[#D9234F]') : 'text-ink-400')}>
                      {x?.hitRate !== null && x?.hitRate !== undefined ? `${fmt(x.hitRate, 0)}%` : '–'}
                    </p>
                    <p className="text-[9.5px] text-ink-400 mt-0.5">{x ? `${x.success}W / ${x.failure}L` : '–'}</p>
                  </div>
                )
              })}
            </div>
            <Link to="/performance" className="mt-3 inline-block text-xs font-bold text-[#7046E8] hover:underline">
              Full Analytics →
            </Link>
          </Card>
        </div>
      </div>

      {/* ── Regime Notes ── */}
      <Card title="Regime & Market Structure Notes" className="mt-6">
        <ul className="grid gap-2.5 text-xs text-ink-700 md:grid-cols-2">
          {overview.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7046E8]" />
              <span>{n}</span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7046E8]" />
            <span>
              <strong>{overview.breadth.newHighs20}</strong> stocks made new 20-day highs, <strong>{overview.breadth.newLows20}</strong> made new 20-day lows; <strong>{fmt(overview.breadth.pctAboveSma200, 0)}%</strong> trade above their 200-SMA.
            </span>
          </li>
        </ul>
      </Card>
    </>
  )
}

/** Sector Strength Row List (Design Spec §6.7) */
export function SectorList({ sectors, limit = 10 }: { sectors: SectorStrengthDto[]; limit?: number }) {
  const list = sectors.slice(0, limit)

  return (
    <motion.ul variants={staggerList} initial="hidden" animate="show" className="space-y-3">
      {list.map((s) => {
        const isOutperforming = s.relativeStrength20 >= 0
        return (
          <motion.li key={s.sector} variants={fadeUp} className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink-900 truncate">
                <span className="text-ink-400 mr-1 tnum">{s.rank}.</span>
                {s.sector}
              </span>
              <span
                className={clsx(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  isOutperforming ? 'bg-[#E8FAF4] text-[#079B73]' : 'bg-[#FFF0F3] text-[#D9234F]',
                )}
              >
                {isOutperforming ? 'Outperforming' : 'Under pressure'}
              </span>
            </div>
            {/* Mint or Rose horizontal bar over pale blue-gray track (§6.7) */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-[#DFE6F1] overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-500', isOutperforming ? 'bg-[#079B73]' : 'bg-[#D9234F]')}
                  style={{ width: `${Math.min(100, Math.max(10, s.score))}%` }}
                />
              </div>
              <span className="text-[11px] font-bold tnum text-ink-800 w-6 text-right">
                {fmt(s.score, 0)}
              </span>
            </div>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
