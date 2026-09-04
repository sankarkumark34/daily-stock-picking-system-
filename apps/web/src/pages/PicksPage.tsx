import type { PickDto } from '@nse/shared'
import { FACTOR_LABELS } from '@nse/shared'
import clsx from 'clsx'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, Callout, Card, EmptyState, FactorBar, KV, PageHeader, Select, Skeleton, Term, fadeUp, staggerList } from '../components/ui'
import { useBacktestRuns, usePickDates, usePicks } from '../lib/api'
import { dateLong, fmt, inr, outcomeLabel, outcomeTone, pct, regimeLabel, regimeTone, scoreTone, setupLabel, setupTone, signTone } from '../lib/format'

export function PicksPage() {
  const [params, setParams] = useSearchParams()
  const runId = params.get('runId') ? Number(params.get('runId')) : null
  const date = params.get('date') ?? undefined
  const { data: dates } = usePickDates(runId)
  const { data, isLoading, error } = usePicks(date, runId)
  const { data: runs } = useBacktestRuns()

  const sector = params.get('sector') ?? ''
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'runId') next.delete('date')
    setParams(next, { replace: true })
  }
  const sectors = [...new Set((data?.picks ?? []).map((p) => p.sector))].sort()
  const visible = sector ? (data?.picks ?? []).filter((p) => p.sector === sector) : (data?.picks ?? [])

  return (
    <>
      <PageHeader
        title="Daily Picks"
        description={data?.date ? `Ranked long ideas generated after the close on ${dateLong(data.date)}. Maximum 10; fewer when the quality bar is not met.` : 'Ranked long ideas generated after each market close.'}
        actions={
          <>
            <Select value={runId ?? ''} onChange={(e) => set('runId', e.target.value || null)} aria-label="Source">
              <option value="">Live picks</option>
              {runs?.filter((r) => r.status === 'COMPLETED').map((r) => (
                <option key={r.id} value={r.id}>
                  Backtest #{r.id} · {r.label}
                </option>
              ))}
            </Select>
            <Select value={sector} onChange={(e) => set('sector', e.target.value || null)} aria-label="Sector filter">
              <option value="">All sectors ({data?.picks.length ?? 0})</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s} ({data?.picks.filter((p) => p.sector === s).length})
                </option>
              ))}
            </Select>
            <Select value={date ?? data?.date ?? ''} onChange={(e) => set('date', e.target.value || null)} aria-label="Date">
              {(dates ?? []).map((d) => (
                <option key={d} value={d}>
                  {dateLong(d)}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {error && <Callout tone="danger">{(error as Error).message}</Callout>}
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : !data?.picks.length ? (
        <EmptyState
          title="No picks for this date"
          body={runId ? 'The backtest produced no qualifying setups on this day.' : 'Either the daily pipeline has not run yet, or no stock cleared the minimum quality score. Run it from the Data page.'}
        />
      ) : visible.length === 0 ? (
        <EmptyState title={`No picks in ${sector}`} body="Clear the sector filter to see the full list." />
      ) : (
        <Card padded={false} title={sector ? `${sector} · ${visible.length} of ${data.picks.length} picks` : undefined}>
          <PicksTable picks={visible} />
        </Card>
      )}
    </>
  )
}

export function PicksTable({ picks, compact = false }: { picks: PickDto[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-10">#</th>
            <th>Stock</th>
            <th><Term k="setup">Setup</Term></th>
            <th className="text-right"><Term k="score">Score</Term></th>
            <th className="text-right"><Term k="confidence">Conf.</Term></th>
            <th className="text-right"><Term k="entry">Entry</Term></th>
            <th className="text-right"><Term k="target">Target</Term></th>
            <th className="text-right"><Term k="stopLoss">Stop</Term></th>
            <th className="text-right"><Term k="riskReward">R:R</Term></th>
            {!compact && <th className="text-right"><Term k="holdDays">Hold</Term></th>}
            <th><Term k="outcome">Outcome</Term></th>
            {!compact && <th className="text-right"><Term k="netReturn">Net</Term></th>}
            <th className="w-8" />
          </tr>
        </thead>
        <motion.tbody variants={staggerList} initial="hidden" animate="show">
          {picks.map((p) => {
            const isOpen = open === p.id
            return (
              <Fragment key={p.id}>
                <motion.tr variants={fadeUp} className={clsx('cursor-pointer', isOpen && 'bg-brand-50/40')} onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                  <td className="text-ink-500 tnum">{p.rank}</td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink-900">{p.symbol}</span>
                      <span className="max-w-[220px] truncate text-[11px] text-ink-500">{p.name ?? p.sector}</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone={setupTone(p.setup)}>{setupLabel(p.setup)}</Badge>
                  </td>
                  <td className="num">
                    <span className={clsx('font-semibold', { 'text-up-700': p.score >= 80, 'text-brand-700': p.score >= 70 && p.score < 80 })}>{fmt(p.score, 1)}</span>
                  </td>
                  <td className="num">{p.confidence}%</td>
                  <td className="num">{inr(p.entry)}</td>
                  <td className="num text-up-700">{inr(p.target)}</td>
                  <td className="num text-down-700">{inr(p.stopLoss)}</td>
                  <td className="num">{fmt(p.riskReward, 2)}</td>
                  {!compact && <td className="num">{p.holdDays}d</td>}
                  <td>
                    <Badge tone={outcomeTone(p.outcome)}>{outcomeLabel(p.outcome)}</Badge>
                  </td>
                  {!compact && <td className={clsx('num', p.netReturnPct !== null && (p.netReturnPct >= 0 ? 'text-up-700' : 'text-down-700'))}>{pct(p.netReturnPct, 2, true)}</td>}
                  <td className="text-ink-400">
                    <ChevronDown size={16} className={clsx('transition-transform', isOpen && 'rotate-180')} />
                  </td>
                </motion.tr>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <tr>
                      <td colSpan={compact ? 11 : 13} className="!p-0">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                          <PickDetail pick={p} />
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Fragment>
            )
          })}
        </motion.tbody>
      </table>
    </div>
  )
}

export function PickDetail({ pick: p }: { pick: PickDto }) {
  return (
    <div className="grid gap-5 border-t border-ink-100 bg-ink-50/60 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr]">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Why selected</h3>
        <ul className="space-y-1.5 text-sm text-ink-700">
          {p.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={regimeTone(p.regime)}>{regimeLabel(p.regime)} market</Badge>
          <Badge tone="neutral">{p.sector}</Badge>
          {p.setupSuccessRate !== null && <Badge tone={p.setupSuccessRate >= 0.5 ? 'success' : 'warning'}>Setup historical win rate {(p.setupSuccessRate * 100).toFixed(0)}%</Badge>}
          <Link to={`/stocks/${p.symbol}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Open chart <ExternalLink size={12} />
          </Link>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Trade plan</h3>
        <KV k={<Term k="entry">Entry range</Term>} v={`${inr(p.entryLow)} – ${inr(p.entryHigh)}`} />
        <KV k={<Term k="target">Target</Term>} v={<span className="text-up-700">{inr(p.target)} (+{fmt(p.rewardPct, 1)}%)</span>} />
        <KV k={<Term k="stopLoss">Stop loss</Term>} v={<span className="text-down-700">{inr(p.stopLoss)} (−{fmt(p.riskPct, 1)}%)</span>} />
        <KV k={<Term k="riskReward">Risk / reward</Term>} v={`${fmt(p.riskReward, 2)} : 1`} />
        <KV k={<Term k="holdDays">Expected holding</Term>} v={`${p.holdDays} sessions`} />
        <KV k={<Term k="score">Composite score</Term>} v={<Badge tone={scoreTone(p.score)}>{fmt(p.score, 1)} / 100</Badge>} mono={false} />
        <KV k={<Term k="confidence">Confidence</Term>} v={`${p.confidence}%`} />
        {p.outcome !== 'OPEN' && (
          <>
            <KV k={<Term k="outcome">Outcome</Term>} v={<Badge tone={outcomeTone(p.outcome)}>{outcomeLabel(p.outcome)}</Badge>} mono={false} />
            <KV k="Exit" v={`${inr(p.exitPrice)} on ${p.outcomeDate ?? '–'} (${p.daysHeld ?? '–'}d)`} />
            <KV k={<Term k="netReturn">Net return</Term>} v={<span className={signTone(p.netReturnPct) === 'success' ? 'text-up-700' : 'text-down-700'}>{pct(p.netReturnPct, 2, true)}</span>} />
          </>
        )}
      </div>
      <div>
        <h3 className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Factor breakdown <Term k="score"> </Term></h3>
        <div className="space-y-2.5">
          {p.factors.map((f) => (
            <FactorBar key={f.name} label={FACTOR_LABELS[f.name]} raw={f.raw} weight={f.weight} note={f.note} tip={f.name} />
          ))}
        </div>
      </div>
    </div>
  )
}
