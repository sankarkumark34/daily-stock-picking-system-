import type { IpoDto } from '@nse/shared'
import clsx from 'clsx'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Layers,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge, Card, Skeleton, fadeUp, staggerList } from '../components/ui'
import { useUpcomingIpos } from '../lib/api'
import { fmt } from '../lib/format'

/* ─────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                 */
/* ─────────────────────────────────────────────────────────────────────── */
function fmtDate(s: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch {
    return s
  }
}

function subTone(x: number) {
  if (x >= 10) return 'text-up-700'
  if (x >= 2) return 'text-brand-700'
  if (x >= 1) return 'text-warn-700'
  return 'text-down-700'
}

function subLabel(x: number) {
  if (x >= 10) return '🔥 Mega'
  if (x >= 3) return '💪 Strong'
  if (x >= 2) return '✅ Good'
  if (x >= 1) return '📊 Moderate'
  return x > 0 ? '🔄 Low' : '—'
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Page                                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */
export function IposPage() {
  const { data: ipos, isLoading, error } = useUpcomingIpos()
  const [showOnlyElite, setShowOnlyElite] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const displayed = ipos?.filter((ipo) => (showOnlyElite ? ipo.isElite : true)) ?? []
  const openIpos = ipos?.filter((i) => i.status === 'OPEN') ?? []
  const upcomingIpos = ipos?.filter((i) => i.status === 'UPCOMING') ?? []

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-down-600">
        <AlertCircle size={36} />
        <p className="font-medium">Failed to load IPO data</p>
        <p className="text-sm text-ink-500">{(error as Error).message}</p>
      </div>
    )
  }

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-6">
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink-900">
            <Rocket className="text-brand-600" size={22} />
            Upcoming IPOs
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Live NSE data · subscription trends · QIB / NNI / Retail breakdown · Elite grade analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="rounded-full border border-up-100 bg-up-50 px-3 py-1 text-xs font-semibold text-up-700">
              🟢 {openIpos.length} Open
            </span>
            <span className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">
              🕐 {upcomingIpos.length} Upcoming
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowOnlyElite(!showOnlyElite)}
            className={clsx(
              'rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
              showOnlyElite
                ? 'border-brand-400 bg-brand-600 text-white'
                : 'border-ink-200 bg-white/60 text-ink-700 hover:bg-ink-100',
            )}
          >
            💎 Elite Only
          </button>
        </div>
      </motion.div>

      {/* ── Market Overview Chart: All IPOs subscription comparison ── */}
      {ipos && ipos.length > 0 && (
        <motion.div variants={fadeUp}>
          <SubscriptionOverviewChart ipos={ipos} />
        </motion.div>
      )}

      {/* ── IPO Cards ── */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-ink-500">
          <Layers size={28} className="text-ink-300" />
          <p>{showOnlyElite ? 'No Elite Grade IPOs found at this time.' : 'No upcoming IPOs found at this time.'}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayed.map((ipo) => (
            <motion.div key={ipo.symbol} variants={fadeUp}>
              <IpoCard
                ipo={ipo}
                expanded={expandedId === ipo.symbol}
                onToggle={() => setExpandedId(expandedId === ipo.symbol ? null : ipo.symbol)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Subscription overview bar chart — all IPOs side by side                */
/* ─────────────────────────────────────────────────────────────────────── */
function SubscriptionOverviewChart({ ipos }: { ipos: IpoDto[] }) {
  const withSub = ipos.filter((i) => i.qibSubscription > 0 || i.nniSubscription > 0 || i.retailSubscription > 0)
  if (!withSub.length) return null

  const data = withSub.map((ipo) => ({
    name: ipo.symbol.length > 10 ? ipo.symbol.slice(0, 10) + '…' : ipo.symbol,
    overall: ipo.qibSubscription > 0 ? ipo.qibSubscription : 0,
    QIB: ipo.qibSubscription > 0 && ipo.nniSubscription > 0 ? ipo.qibSubscription : 0,
    NNI: ipo.nniSubscription,
    Retail: ipo.retailSubscription,
    isElite: ipo.isElite,
  }))

  // Check if we have category breakdown or only overall
  const hasBreakdown = data.some((d) => d.NNI > 0 || d.Retail > 0)

  return (
    <Card
      title={<span className="flex items-center gap-2"><BarChart3 size={15} className="text-brand-600" /> IPO Subscription Comparison</span>}
      subtitle="Times subscribed — all current & upcoming IPOs"
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}×`} />
            <Tooltip
              formatter={(v: number, name: string) => [`${fmt(v, 2)}×`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            {hasBreakdown ? (
              <>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="QIB" name="QIB" fill="#6d28d9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="NNI" name="NNI/HNI" fill="#0891b2" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Retail" name="Retail" fill="#059669" radius={[3, 3, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="overall" name="Overall" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.isElite ? '#7c3aed' : '#94a3b8'} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        Purple = Elite Grade · Grey = Standard · Values = subscription multiples (×)
      </p>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Individual IPO Card                                                     */
/* ─────────────────────────────────────────────────────────────────────── */
function IpoCard({ ipo, expanded, onToggle }: { ipo: IpoDto; expanded: boolean; onToggle: () => void }) {
  const overallSub = ipo.qibSubscription
  const hasBreakdown = ipo.nniSubscription > 0 || ipo.retailSubscription > 0
  const hasTrend = ipo.subscriptionTrend && ipo.subscriptionTrend.length > 1

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border-2 bg-white/60 backdrop-blur-sm shadow-sm transition-all duration-300',
        ipo.isElite ? 'border-brand-300 hover:shadow-brand-100 hover:shadow-md' : 'border-ink-200 hover:shadow-md',
      )}
    >
      {/* Elite gradient strip */}
      {ipo.isElite && (
        <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-500 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
          <Sparkles size={11} className="animate-pulse" /> ELITE GRADE <Sparkles size={11} className="animate-pulse" />
        </div>
      )}

      {/* Header */}
      <div className={clsx('p-4', ipo.isElite ? '' : '')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={ipo.status === 'OPEN' ? 'success' : 'neutral'} size="sm">
                {ipo.status === 'OPEN' ? '🟢 Open' : '🕐 Upcoming'}
              </Badge>
              {ipo.daysToClose !== null && ipo.status === 'OPEN' && (
                <span className="text-[11px] font-semibold text-warn-700">
                  {ipo.daysToClose === 0 ? 'Closes today!' : `${ipo.daysToClose}d left`}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-bold text-ink-900 text-base leading-tight truncate">{ipo.companyName}</h3>
            <p className="text-xs text-ink-500 mt-0.5">{ipo.symbol} · {ipo.sector}</p>
          </div>
          {overallSub > 0 && (
            <div className="shrink-0 text-right">
              <p className={clsx('text-xl font-black tnum', subTone(overallSub))}>{fmt(overallSub, 2)}×</p>
              <p className="text-[10px] font-semibold text-ink-500">{subLabel(overallSub)}</p>
            </div>
          )}
        </div>

        {/* Key info grid */}
        <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <InfoCell icon={<CalendarDays size={12} />} label="Open" value={fmtDate(ipo.openDate)} />
          <InfoCell icon={<CalendarDays size={12} />} label="Close" value={fmtDate(ipo.closeDate)} />
          <InfoCell icon={<TrendingUp size={12} />} label="Price Band" value={ipo.priceBand || '—'} />
          <InfoCell icon={<Layers size={12} />} label="Issue Size" value={ipo.issueSize || '—'} />
          {ipo.lotSize > 0 && (
            <InfoCell icon={<BarChart3 size={12} />} label="Lot Size" value={`${ipo.lotSize} shares`} />
          )}
        </div>

        {/* Subscription bars */}
        {overallSub > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 flex items-center gap-1">
              <Users size={11} /> Subscription
            </p>
            {hasBreakdown ? (
              <>
                <SubBar label="Overall" value={overallSub} max={Math.max(overallSub, ipo.qibSubscription, ipo.nniSubscription, ipo.retailSubscription)} color="brand" />
                <SubBar label="QIB" value={ipo.qibSubscription} max={overallSub * 1.5} color="violet" />
                <SubBar label="NNI/HNI" value={ipo.nniSubscription} max={overallSub * 1.5} color="sky" />
                <SubBar label="Retail" value={ipo.retailSubscription} max={overallSub * 1.5} color="emerald" />
              </>
            ) : (
              <SubBar label="Overall" value={overallSub} max={Math.max(overallSub, 10)} color="brand" />
            )}
          </div>
        )}

        {/* Elite reasons */}
        {ipo.isElite && ipo.eliteReasons.length > 0 && (
          <div className="mt-3 space-y-1">
            {ipo.eliteReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-md border border-brand-100 bg-brand-50/60 px-2 py-1.5 text-[11px] text-brand-800">
                <span className="mt-0.5 text-brand-500 shrink-0">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expand toggle */}
        {(hasTrend || overallSub > 0) && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50/60 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 transition-colors"
          >
            <BarChart3 size={12} />
            {expanded ? 'Hide' : 'View'} trend chart &amp; analysis
            <ChevronDown size={12} className={clsx('transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Expandable: Trend Chart + Category Chart */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-100 px-4 pb-4 pt-3 space-y-4">
              {/* Day-wise trend chart */}
              {hasTrend && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Day-wise Subscription Trend
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ipo.subscriptionTrend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}×`} />
                        <Tooltip formatter={(v: number) => [`${fmt(v, 2)}×`]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="overall" name="Overall" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} />
                        {ipo.subscriptionTrend.some((d) => d.qib > 0) && (
                          <Line type="monotone" dataKey="qib" name="QIB" stroke="#0891b2" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        )}
                        {ipo.subscriptionTrend.some((d) => d.retail > 0) && (
                          <Line type="monotone" dataKey="retail" name="Retail" stroke="#059669" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Category breakdown bar chart */}
              {hasBreakdown && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    Category Breakdown
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { category: 'QIB', value: ipo.qibSubscription },
                          { category: 'NNI/HNI', value: ipo.nniSubscription },
                          { category: 'Retail', value: ipo.retailSubscription },
                        ]}
                        margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}×`} />
                        <Tooltip formatter={(v: number) => [`${fmt(v, 2)}×`]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="value" name="Subscription" radius={[4, 4, 0, 0]}>
                          <Cell fill="#6d28d9" />
                          <Cell fill="#0891b2" />
                          <Cell fill="#059669" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Analysis summary */}
              <AnalysisSummary ipo={ipo} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Subscription progress bar ── */
function SubBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const colorMap: Record<string, { bar: string; text: string }> = {
    brand: { bar: 'bg-brand-500', text: 'text-brand-700' },
    violet: { bar: 'bg-violet-500', text: 'text-violet-700' },
    sky: { bar: 'bg-sky-500', text: 'text-sky-700' },
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-700' },
  }
  const c = colorMap[color] ?? colorMap['brand']

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-ink-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', c.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={clsx('w-10 shrink-0 text-right font-bold tnum', c.text)}>
        {value > 0 ? `${fmt(value, 2)}×` : '—'}
      </span>
    </div>
  )
}

/* ── Analysis summary ── */
function AnalysisSummary({ ipo }: { ipo: IpoDto }) {
  const overallSub = ipo.qibSubscription
  const qib = ipo.qibSubscription
  const nni = ipo.nniSubscription
  const retail = ipo.retailSubscription

  const signals: { icon: string; text: string; tone: 'up' | 'warn' | 'down' | 'neutral' }[] = []

  if (overallSub >= 10) signals.push({ icon: '🔥', text: `Mega oversubscription at ${fmt(overallSub, 1)}× — very strong listing likely`, tone: 'up' })
  else if (overallSub >= 3) signals.push({ icon: '💪', text: `Strong subscription ${fmt(overallSub, 1)}× — good listing expected`, tone: 'up' })
  else if (overallSub >= 1.5) signals.push({ icon: '📊', text: `Decent subscription ${fmt(overallSub, 1)}× — moderate interest`, tone: 'warn' })
  else if (overallSub > 0) signals.push({ icon: '⚠️', text: `Weak subscription ${fmt(overallSub, 1)}× — listing risk elevated`, tone: 'down' })

  if (qib >= 5 && nni > 0) signals.push({ icon: '🏦', text: `QIB ${fmt(qib, 1)}× + NNI ${fmt(nni, 1)}× — institutional conviction strong`, tone: 'up' })
  else if (qib >= 2) signals.push({ icon: '🏦', text: `QIB ${fmt(qib, 1)}× — institutions interested`, tone: 'up' })

  if (retail >= 2) signals.push({ icon: '👥', text: `Retail ${fmt(retail, 1)}× — strong retail participation`, tone: 'up' })

  if (ipo.daysToClose === 0) signals.push({ icon: '⏰', text: 'Last day to apply — closes today!', tone: 'warn' })
  else if (ipo.daysToClose === 1) signals.push({ icon: '⏰', text: 'Closes tomorrow — time running out', tone: 'warn' })

  if (!signals.length) {
    signals.push({ icon: '📋', text: 'Subscription data not yet available for this IPO', tone: 'neutral' })
  }

  const toneClass = {
    up: 'bg-up-50 border-up-100 text-up-900',
    warn: 'bg-warn-50 border-warn-100 text-warn-900',
    down: 'bg-down-50 border-down-100 text-down-900',
    neutral: 'bg-ink-50 border-ink-200 text-ink-700',
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Analysis</p>
      <div className="space-y-1.5">
        {signals.map((s, i) => (
          <div key={i} className={clsx('flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px]', toneClass[s.tone])}>
            <span className="shrink-0">{s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
      {ipo.gmpPercent > 0 && (
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-up-100 bg-up-50 px-2.5 py-2 text-[11px] text-up-900">
          <TrendingUp size={12} className="shrink-0" />
          Est. GMP: +{ipo.gmpPercent}% above issue price
        </div>
      )}
      <div className="mt-2 rounded-md border border-ink-100 bg-ink-50/60 px-2.5 py-2 text-[10px] text-ink-500">
        ⚠️ IPO subscriptions do not guarantee listing gains. Past oversubscription does not predict future returns. Consult a SEBI-registered advisor.
      </div>
    </div>
  )
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-0.5">
        {icon} {label}
      </div>
      <div className="font-medium text-ink-800">{value}</div>
    </div>
  )
}
