import type { LiveQuoteDto } from '@nse/shared'
import clsx from 'clsx'
import { Radio } from 'lucide-react'
import { fmt, inr, pct } from '../lib/format'
import { InfoTip } from './ui'

/** Small "LIVE / DELAYED / CLOSED" pill with the source and time of the last tick. */
export function LiveBadge({ q, className }: { q: LiveQuoteDto | null | undefined; className?: string }) {
  if (!q) return null
  const t = new Date(q.asOf)
  const hhmm = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const label = q.marketOpen ? (q.delayMinutes > 0 ? `Delayed ~${q.delayMinutes} min` : 'Live') : `Market closed · last ${hhmm}`
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset', q.marketOpen ? 'bg-up-50 text-up-700 ring-up-100' : 'bg-ink-100 text-ink-600 ring-ink-200', className)}>
      <Radio size={10} className={q.marketOpen ? 'animate-pulse' : ''} />
      {label}
      <InfoTip
        title="Live price (delayed)"
        text={`Quotes come from a free public feed (${q.source}) with roughly ${q.delayMinutes} minutes delay, refreshed every minute. The model itself uses official NSE end-of-day data; this is only to show where the price is now versus the plan.`}
      />
    </span>
  )
}

/** LTP with day change, e.g. "₹1,322.00  +1.5%". */
export function LivePrice({ q, size = 'md' }: { q: LiveQuoteDto | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!q) return <span className="text-ink-400">–</span>
  const up = q.changePct >= 0
  return (
    <span className={clsx('inline-flex items-baseline gap-1.5 tnum', size === 'lg' ? 'text-2xl font-semibold' : size === 'md' ? 'text-sm font-semibold' : 'text-xs font-medium')}>
      <span className="text-ink-900">{inr(q.ltp)}</span>
      <span className={clsx(size === 'lg' ? 'text-sm' : 'text-[11px]', up ? 'text-up-600' : 'text-down-600')}>{pct(q.changePct, 2, true)}</span>
    </span>
  )
}

/**
 * Where the live price sits between stop and target for an open pick:
 * a small bar with the entry marker plus % moved since entry.
 */
export function LiveVsPlan({ q, entry, target, stopLoss }: { q: LiveQuoteDto | null | undefined; entry: number; target: number; stopLoss: number }) {
  if (!q) return <span className="text-xs text-ink-400">–</span>
  const span = target - stopLoss
  const pos = span > 0 ? Math.max(0, Math.min(100, ((q.ltp - stopLoss) / span) * 100)) : 50
  const entryPos = span > 0 ? ((entry - stopLoss) / span) * 100 : 50
  const sinceEntry = (q.ltp / entry - 1) * 100
  const toTarget = (target / q.ltp - 1) * 100
  const toStop = (q.ltp / stopLoss - 1) * 100
  const hitT = q.ltp >= target
  const hitS = q.ltp <= stopLoss
  return (
    <div className="min-w-[150px]" title={`Live ${inr(q.ltp)} · ${pct(toTarget, 1, true)} to target · ${fmt(toStop, 1)}% above stop`}>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="tnum font-semibold text-ink-900">{inr(q.ltp)}</span>
        <span className={clsx('tnum font-medium', sinceEntry >= 0 ? 'text-up-700' : 'text-down-700')}>{pct(sinceEntry, 1, true)}</span>
      </div>
      <div className="relative mt-1 h-1.5 w-full rounded-full bg-gradient-to-r from-down-100 via-ink-100 to-up-100">
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink-400" style={{ left: `${entryPos}%` }} aria-hidden />
        <span
          className={clsx('absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white', hitT ? 'bg-up-600' : hitS ? 'bg-down-600' : sinceEntry >= 0 ? 'bg-up-600' : 'bg-down-600')}
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-ink-400">
        <span>stop</span>
        <span>{hitT ? 'target touched' : hitS ? 'stop touched' : `${pct(toTarget, 1)} to go`}</span>
        <span>target</span>
      </div>
    </div>
  )
}
