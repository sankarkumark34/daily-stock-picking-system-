import type { PickDto } from '@nse/shared'
import { FACTOR_LABELS } from '@nse/shared'
import clsx from 'clsx'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Badge, Callout, Card, EmptyState, FactorBar, KV, PageHeader, Select, Skeleton, Term, fadeUp, staggerList } from '../components/ui'
import { useBacktestRuns, useLiveQuotes, usePickDates, usePicks } from '../lib/api'
import { FilterSelect, SortTh, TableToolbar, useSortFilter } from '../components/table'
import { LiveBadge, LiveVsPlan } from '../components/LivePrice'
import { dateLong, fmt, inr, outcomeLabel, outcomeTone, pct, regimeLabel, regimeTone, scoreTone, setupLabel, setupTone, signTone } from '../lib/format'

export function PicksPage() {
  const [params, setParams] = useSearchParams()
  const runId = params.get('runId') ? Number(params.get('runId')) : null
  const date = params.get('date') ?? undefined
  const { data: dates } = usePickDates(runId)
  const { data, isLoading, error } = usePicks(date, runId)
  const { data: runs } = useBacktestRuns()

  const [tradeValue, setTradeValue] = useState<number>(10000)
  const [maxEntryPrice, setMaxEntryPrice] = useState<number | null>(1800)
  const [horizonFilter, setHorizonFilter] = useState<'ALL' | 'SHORT_TERM' | 'LONG_TERM'>('ALL')

  const sector = params.get('sector') ?? ''
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'runId') next.delete('date')
    setParams(next, { replace: true })
  }
  const sectors = [...new Set((data?.picks ?? []).map((p) => p.sector))].sort()

  let visible = sector ? (data?.picks ?? []).filter((p) => p.sector === sector) : (data?.picks ?? [])
  if (horizonFilter === 'SHORT_TERM') {
    visible = visible.filter((p) => p.holdDays <= 14)
  } else if (horizonFilter === 'LONG_TERM') {
    visible = visible.filter((p) => p.holdDays > 14)
  }
  if (maxEntryPrice !== null) {
    visible = visible.filter((p) => p.entry <= maxEntryPrice)
  }

  const sprintCount = (data?.picks ?? []).filter((p) => p.holdDays <= 14).length
  const marathonCount = (data?.picks ?? []).filter((p) => p.holdDays > 14).length

  return (
    <>
      <PageHeader
        title="Daily Picks"
        description={data?.date ? `Ranked ideas generated after the close on ${dateLong(data.date)}. Calibrated for 10-day 15% momentum sprints and 30%+ positional trends.` : 'Ranked ideas generated after each market close.'}
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

      {/* Strategy Horizon Tabs & Trade Value Validation Center */}
      <div className="mb-3 grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setHorizonFilter('ALL')}
            className={clsx(
              'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              horizonFilter === 'ALL' ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100',
            )}
          >
            All Horizons ({data?.picks.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setHorizonFilter('SHORT_TERM')}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              horizonFilter === 'SHORT_TERM' ? 'bg-violet-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100',
            )}
          >
            <span>⚡ Sprint-15</span>
            <span className="rounded bg-black/10 px-1 py-0.5 text-[10px]">10 Days · ≥15% ({sprintCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setHorizonFilter('LONG_TERM')}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              horizonFilter === 'LONG_TERM' ? 'bg-up-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100',
            )}
          >
            <span>🎯 Marathon-30</span>
            <span className="rounded bg-black/10 px-1 py-0.5 text-[10px]">30–60 Days · ≥30% ({marathonCount})</span>
          </button>
        </div>

        {/* Trade Value (10k) Input & Instant Validation Bar */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 p-3 text-xs text-ink-800 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-950">My Trade Value:</span>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 font-bold text-emerald-700">₹</span>
                <input
                  type="number"
                  step="1000"
                  min="500"
                  value={tradeValue}
                  onChange={(e) => setTradeValue(Math.max(1, Number(e.target.value) || 0))}
                  className="w-28 rounded-lg border border-emerald-300 bg-white py-1 pl-6 pr-2 font-bold text-ink-900 shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="10000"
                />
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5">
              {[5000, 10000, 20000, 50000, 100000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTradeValue(v)}
                  className={clsx(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                    tradeValue === v
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-100',
                  )}
                >
                  {v >= 100000 ? '₹1L' : `₹${v / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between border-t border-emerald-200/60 pt-1.5 text-[11px] text-emerald-900">
            <span>
              💡 Live calculation active: validating exact shares, investment, profit at target (+15%), and stop risk for each stock below.
            </span>
            <span className="font-bold">Active Budget: ₹{tradeValue.toLocaleString('en-IN')} / trade</span>
          </div>
        </div>
      </div>

      {/* Max Entry Price Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/90 to-indigo-50/70 p-2.5 text-xs text-sky-950 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold flex items-center gap-1 text-sky-950">
            <span>🏷️</span> Max Entry Price:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: '≤ ₹1,800 (10k Sweet Spot)', val: 1800 },
              { label: '≤ ₹1,000', val: 1000 },
              { label: '≤ ₹500', val: 500 },
              { label: 'All Prices', val: null },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setMaxEntryPrice(chip.val)}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                  maxEntryPrice === chip.val
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'bg-white border border-sky-200 text-sky-900 hover:bg-sky-100',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-sky-800">Custom Max: ₹</span>
          <input
            type="number"
            step="100"
            min="50"
            value={maxEntryPrice ?? ''}
            placeholder="e.g. 1800"
            onChange={(e) => setMaxEntryPrice(e.target.value ? Number(e.target.value) : null)}
            className="w-20 rounded-md border border-sky-300 bg-white px-2 py-0.5 text-xs font-bold text-ink-900 shadow-2xs focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {maxEntryPrice !== null && (
            <button
              type="button"
              onClick={() => setMaxEntryPrice(null)}
              className="text-[11px] font-semibold text-sky-600 hover:text-sky-900 underline cursor-pointer"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {error && <Callout tone="danger">{(error as Error).message}</Callout>}
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : !data?.picks.length ? (
        <EmptyState
          title="No picks for this date"
          body={runId ? 'The backtest produced no qualifying setups on this day.' : 'Either the daily pipeline has not run yet, or no stock cleared the minimum quality score. Run it from the Data page.'}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={`No picks matching filters (Entry ≤ ₹${maxEntryPrice})`}
          body="Click 'All Prices' or clear the filters to see stocks priced higher."
        />
      ) : (
        <Card padded={false} title={`${maxEntryPrice ? `Entry ≤ ₹${maxEntryPrice.toLocaleString('en-IN')} · ` : ''}${horizonFilter === 'SHORT_TERM' ? '⚡ Sprint-15 Momentum · ' : horizonFilter === 'LONG_TERM' ? '🎯 Marathon-30 Positional · ' : ''}${visible.length} of ${data.picks.length} picks`}>
          <PicksTable picks={visible} tradeValue={tradeValue} onTradeValueChange={setTradeValue} />
        </Card>
      )}
    </>
  )
}

export function PicksTable({
  picks,
  compact = false,
  capital: _capital = 500000,
  riskPercent: _riskPercent = 1.0,
  tradeValue = 10000,
  onTradeValueChange,
}: {
  picks: PickDto[];
  compact?: boolean;
  capital?: number;
  riskPercent?: number;
  tradeValue?: number;
  onTradeValueChange?: (v: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null)
  const openSymbols = picks.filter((p) => p.outcome === 'OPEN' && !p.isBacktest).map((p) => p.symbol)
  const { data: quotes } = useLiveQuotes(openSymbols)
  const quoteOf = (s: string) => quotes?.find((q) => q.symbol === s)
  const anyQuote = quotes?.[0]
  const live = openSymbols.length > 0
  const t = useSortFilter(picks, {
    defaultKey: 'rank',
    searchText: (p) => `${p.symbol} ${p.name ?? ''} ${p.sector} ${p.setup} ${p.outcome}`,
    filters: { outcome: (p, v) => p.outcome === v, setup: (p, v) => p.setup === v },
  })
  const outcomes = [...new Set(picks.map((p) => p.outcome))]
  const setups = [...new Set(picks.map((p) => p.setup))]
  return (
    <div>
      {!compact && (
        <TableToolbar query={t.query} onQuery={t.setQuery} count={t.rows.length} total={t.total} onClear={t.clear} active={t.active} placeholder="Filter by symbol, name, sector…">
          <FilterSelect label="All outcomes" value={t.filterValues.outcome ?? ''} onChange={(v) => t.setFilter('outcome', v)} options={outcomes.map((o) => ({ value: o, label: outcomeLabel(o) }))} />
          <FilterSelect label="All setups" value={t.filterValues.setup ?? ''} onChange={(v) => t.setFilter('setup', v)} options={setups.map((s) => ({ value: s, label: setupLabel(s) }))} />
        </TableToolbar>
      )}
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <SortTh k="rank" sort={t.sort} className="w-10">#</SortTh>
              <SortTh k="symbol" sort={t.sort}>Stock</SortTh>
              {live && (
                <th>
                  <span className="inline-flex items-center gap-1.5">
                    Live vs plan <LiveBadge q={anyQuote} />
                  </span>
                </th>
              )}
              <SortTh k="setup" sort={t.sort} tip="setup">Setup</SortTh>
              <SortTh k="score" sort={t.sort} align="right" tip="score">Score</SortTh>
              <SortTh k="confidence" sort={t.sort} align="right" tip="confidence">Conf.</SortTh>
              <SortTh k="entry" sort={t.sort} align="right" tip="entry">Entry</SortTh>
              <SortTh k="target" sort={t.sort} align="right" tip="target">Target</SortTh>
              <SortTh k="stopLoss" sort={t.sort} align="right" tip="stopLoss">Stop</SortTh>
              <SortTh k="riskReward" sort={t.sort} align="right" tip="riskReward">R:R</SortTh>
              {!compact && (
                <th className="text-right">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-800" title="Live calculation based on your active trade value">
                    ₹{tradeValue >= 100000 ? `${(tradeValue / 100000).toFixed(1)}L` : `${Math.round(tradeValue / 1000)}k`} Plan
                  </span>
                </th>
              )}
              {!compact && <SortTh k="holdDays" sort={t.sort} align="right" tip="holdDays">Hold</SortTh>}
              <SortTh k="outcome" sort={t.sort} tip="outcome">Outcome</SortTh>
              {!compact && <SortTh k="netReturnPct" sort={t.sort} align="right" tip="netReturn">Net</SortTh>}
              <th className="w-8" />
            </tr>
          </thead>
          <motion.tbody variants={staggerList} initial="hidden" animate="show">
            {t.rows.map((p) => {
              const isOpen = open === p.id
              const canAfford = tradeValue >= p.entry
              const affordableShares = Math.max(0, Math.floor(tradeValue / p.entry))
              const estProfit = affordableShares * (p.target - p.entry)
              const estInvested = affordableShares * p.entry
              const estRisk = affordableShares * (p.entry - p.stopLoss)

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
                    {live && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {p.outcome === 'OPEN' && !p.isBacktest ? <LiveVsPlan q={quoteOf(p.symbol)} entry={p.entry} target={p.target} stopLoss={p.stopLoss} /> : <span className="text-ink-400">–</span>}
                      </td>
                    )}
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
                    {!compact && (
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        {!canAfford ? (
                          <span
                            className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200"
                            title={`1 share costs ${inr(p.entry)}, budget is ${inr(tradeValue)}`}
                          >
                            Needs {inr(p.entry, 0)}
                          </span>
                        ) : (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-bold text-emerald-700">
                              {affordableShares} shs · +{inr(estProfit, 0)}
                            </span>
                            <span className="text-[10px] text-ink-500">
                              Inv {inr(estInvested, 0)} · Risk −{inr(estRisk, 0)}
                            </span>
                          </div>
                        )}
                      </td>
                    )}
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
                        <td colSpan={100} className="!p-0">
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                            <PickDetail
                              pick={p}
                              capital={_capital}
                              riskPercent={_riskPercent}
                              tradeValue={tradeValue}
                              onTradeValueChange={onTradeValueChange}
                            />
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
    </div>
  )
}

export function PickDetail({
  pick: p,
  capital: _capital = 500000,
  riskPercent: _riskPercent = 1.0,
  tradeValue = 10000,
  onTradeValueChange,
}: {
  pick: PickDto;
  capital?: number;
  riskPercent?: number;
  tradeValue?: number;
  onTradeValueChange?: (v: number) => void;
}) {
  const [localTradeValue, setLocalTradeValue] = useState<number>(tradeValue)

  // Keep local state in sync when parent tradeValue changes
  if (tradeValue !== undefined && tradeValue !== localTradeValue && tradeValue > 0) {
    setLocalTradeValue(tradeValue)
  }

  const handleBudgetChange = (val: number) => {
    const nextVal = Math.max(1, val)
    setLocalTradeValue(nextVal)
    onTradeValueChange?.(nextVal)
  }

  const canAfford = localTradeValue >= p.entry
  const shares = Math.max(0, Math.floor(localTradeValue / p.entry))
  const investedCapital = shares * p.entry
  const unallocatedCash = Math.max(0, localTradeValue - investedCapital)
  const targetProfit = shares * (p.target - p.entry)
  const stopLossRisk = shares * (p.entry - p.stopLoss)
  const capitalUtilPct = localTradeValue > 0 ? (investedCapital / localTradeValue) * 100 : 0
  const breakevenPrice = p.breakevenTrigger ?? Math.round(p.entry * 1.07 * 100) / 100
  const isSprint = p.holdDays <= 14

  return (
    <div className="grid gap-5 border-t border-ink-100 bg-ink-50/60 px-5 py-4 lg:grid-cols-[1.05fr_1.05fr_1.3fr]">
      {/* Column 1: Rationale & Market Context */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Why selected</h3>
          <Badge tone={isSprint ? 'violet' : 'success'}>
            {isSprint ? '⚡ Sprint-15 (10-Day)' : '🎯 Marathon-30 (Positional)'}
          </Badge>
        </div>
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

        {/* Breakeven Shield Info Box */}
        <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/70 p-3 text-xs text-ink-700">
          <p className="font-semibold text-violet-900">🛡️ Breakeven Shield Protocol</p>
          <p className="mt-1 text-ink-600">
            Once price touches <span className="font-semibold text-violet-800">{inr(breakevenPrice)} (+7%)</span>, stop loss moves to Entry ({inr(p.entry)}), locking in a risk-free trade.
          </p>
        </div>
      </div>

      {/* Column 2: Trade Plan Details */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Trade plan</h3>
        <KV k={<Term k="entry">Entry range</Term>} v={`${inr(p.entryLow)} – ${inr(p.entryHigh)}`} />
        <KV k={<Term k="target">Target 1</Term>} v={<span className="font-bold text-up-700">{inr(p.target)} (+{fmt(p.rewardPct, 1)}%)</span>} />
        {p.target2 && <KV k="Target 2 (Runner)" v={<span className="text-up-700">{inr(p.target2)} (+{fmt(p.rewardPct * 1.08, 1)}%)</span>} />}
        <KV k={<Term k="stopLoss">Stop loss</Term>} v={<span className="text-down-700">{inr(p.stopLoss)} (−{fmt(p.riskPct, 1)}%)</span>} />
        <KV k={<Term k="riskReward">Risk / reward</Term>} v={`${fmt(p.riskReward, 2)} : 1`} />
        <KV k={<Term k="holdDays">Expected holding</Term>} v={`${p.holdDays} sessions (${isSprint ? '2 weeks' : '6–8 weeks'})`} />
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

      {/* Column 3: Live Trade Value (10k) Position Sizing & Calculation Validator */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-900">Trade Value & Sizing Validator</h3>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Live ₹ Calculator</span>
        </div>

        {/* Interactive Capital Input Box */}
        <div className="rounded-xl border border-emerald-300 bg-white p-3.5 shadow-sm space-y-3 text-xs text-ink-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2.5">
            <label htmlFor={`trade-val-${p.id}`} className="font-semibold text-ink-700">
              Input Trade Capital:
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center">
                <span className="absolute left-2 font-bold text-emerald-700">₹</span>
                <input
                  id={`trade-val-${p.id}`}
                  type="number"
                  step="1000"
                  min="500"
                  value={localTradeValue}
                  onChange={(e) => handleBudgetChange(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-emerald-300 bg-emerald-50/40 py-0.5 pl-5 pr-1.5 text-right font-bold text-ink-900 shadow-2xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center justify-end gap-1">
            {[5000, 10000, 20000, 50000, 100000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleBudgetChange(v)}
                className={clsx(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                  localTradeValue === v
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-ink-100 text-ink-700 hover:bg-emerald-100 hover:text-emerald-900',
                )}
              >
                {v >= 100000 ? '₹1L' : `₹${v / 1000}k`}
              </button>
            ))}
          </div>

          {/* Capital Validation Result */}
          {!canAfford ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-900">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️</span> Insufficient Capital for 1 Share
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                1 share of {p.symbol} costs <span className="font-bold">{inr(p.entry)}</span>. Your input trade capital is {inr(localTradeValue)}. Increase your trade capital to at least <span className="font-bold">{inr(Math.ceil(p.entry))}</span> to execute this position.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-emerald-950">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <span>✅</span> Position Validated:
                  </span>
                  <span className="text-emerald-800">{shares} shares</span>
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-800">
                  Deploying {inr(investedCapital, 0)} ({capitalUtilPct.toFixed(0)}% of {inr(localTradeValue, 0)} budget)
                </p>
              </div>

              {/* Sizing & Profit/Loss Breakdown */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex justify-between">
                  <span className="text-ink-500">Shares to Buy:</span>
                  <span className="font-bold text-ink-900 tnum">{shares} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Total Capital Invested:</span>
                  <span className="font-semibold text-ink-900 tnum">{inr(investedCapital, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Unallocated Cash:</span>
                  <span className="text-ink-600 tnum">{inr(unallocatedCash, 0)}</span>
                </div>
                <div className="flex justify-between border-t border-ink-100 pt-1.5">
                  <span className="text-ink-500 font-medium">Potential Gain (Target 1):</span>
                  <span className="font-bold text-up-700 tnum">+{inr(targetProfit, 0)} (+{fmt(p.rewardPct, 1)}%)</span>
                </div>
                {p.target2 && (
                  <div className="flex justify-between">
                    <span className="text-ink-500 font-medium">Runner Gain (Target 2):</span>
                    <span className="font-semibold text-up-700 tnum">+{inr(shares * (p.target2 - p.entry), 0)} (+{fmt(p.rewardPct * 1.08, 1)}%)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-500">Max Risk (Stop Loss):</span>
                  <span className="font-semibold text-down-700 tnum">−{inr(stopLossRisk, 0)} (−{fmt(p.riskPct, 1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 font-medium">Reward / Risk in ₹:</span>
                  <span className="font-bold text-emerald-800 tnum">
                    Risk {inr(stopLossRisk, 0)} to make +{inr(targetProfit, 0)} ({fmt(p.riskReward, 2)} : 1)
                  </span>
                </div>
                <div className="rounded border border-violet-100 bg-violet-50/50 p-1.5 text-[11px] text-violet-900">
                  🛡️ <strong>Shield Trigger:</strong> At {inr(breakevenPrice)}, stop becomes entry ({inr(p.entry)}). Risk drops to <strong>₹0</strong>!
                </div>
              </div>
            </>
          )}
        </div>

        {/* Factor Breakdown */}
        <h3 className="mb-2 mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Factor breakdown <Term k="score"> </Term></h3>
        <div className="space-y-1.5">
          {p.factors.map((f) => (
            <FactorBar key={f.name} label={FACTOR_LABELS[f.name]} raw={f.raw} weight={f.weight} note={f.note} tip={f.name} />
          ))}
        </div>
      </div>
    </div>
  )
}
