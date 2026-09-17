import type { LiveQuoteDto } from '@nse/shared'
import clsx from 'clsx'
import { Radio } from 'lucide-react'
import { inr, pct } from '../lib/format'
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
 * Where the live price sits between stop and target for an open pick (Design Spec §6.6):
 * a pale track with single colored progress indicator, entry pin, and distance-to-target.
 */
export function LiveVsPlan({
  q,
  entry,
  target,
  stopLoss,
}: {
  q: LiveQuoteDto | null | undefined
  entry: number
  target: number
  stopLoss: number
}) {
  if (!q) return <span className="text-xs text-ink-400">–</span>
  const span = target - stopLoss
  const pos = span > 0 ? Math.max(0, Math.min(100, ((q.ltp - stopLoss) / span) * 100)) : 50
  const entryPos = span > 0 ? ((entry - stopLoss) / span) * 100 : 50
  const sinceEntry = (q.ltp / entry - 1) * 100
  const toTarget = (target / q.ltp - 1) * 100
  const hitT = q.ltp >= target
  const hitS = q.ltp <= stopLoss

  return (
    <div className="min-w-[160px] space-y-1" title={`Live ${inr(q.ltp)} · ${pct(toTarget, 1, true)} to target`}>
      {/* Numeric values (never replaced by visual) */}
      <div className="flex items-baseline justify-between text-xs">
        <span className="tnum font-bold text-ink-950">{inr(q.ltp)}</span>
        <span className={clsx('tnum text-[11px] font-bold', sinceEntry >= 0 ? 'text-[#079B73]' : 'text-[#D9234F]')}>
          {pct(sinceEntry, 1, true)}
        </span>
      </div>

      {/* Pale track with entry pin and colored indicator dot (§6.6) */}
      <div className="relative h-1.5 w-full rounded-full bg-[#DFE6F1] overflow-visible">
        {/* Entry line marker */}
        <span
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink-400/80 rounded-full"
          style={{ left: `${entryPos}%` }}
          aria-hidden
        />
        {/* Progress indicator dot */}
        <span
          className={clsx(
            'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-xs transition-all duration-300',
            hitT || sinceEntry >= 0 ? 'bg-[#079B73]' : 'bg-[#D9234F]',
          )}
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>

      {/* Short labels below (§6.6) */}
      <div className="flex justify-between text-[10px] font-medium text-ink-400">
        <span>Stop</span>
        <span className={clsx('font-bold', hitT ? 'text-[#079B73]' : hitS ? 'text-[#D9234F]' : 'text-ink-600')}>
          {hitT ? 'Target Hit! 🎯' : hitS ? 'Stop Triggered ⚠️' : `${pct(toTarget, 1)} to target`}
        </span>
        <span>Target</span>
      </div>
    </div>
  )
}
