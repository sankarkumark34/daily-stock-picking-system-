import type { IpoDto } from '@nse/shared'
import clsx from 'clsx'
import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Layers,
  Rocket,
  SlidersHorizontal,
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
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Badge,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip as UiTooltip,
  fadeUp,
  staggerList,
} from '../components/ui'
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
  if (x >= 30) return 'text-purple-700 font-extrabold'
  if (x >= 10) return 'text-up-700'
  if (x >= 2) return 'text-brand-700'
  if (x >= 1) return 'text-warn-700'
  return 'text-down-700'
}

function subLabel(x: number) {
  if (x >= 30) return '💎 Elite (≥30×)'
  if (x >= 10) return '🔥 Mega'
  if (x >= 3) return '💪 Strong'
  if (x >= 2) return '✅ Good'
  if (x >= 1) return '📊 Moderate'
  return x > 0 ? '🔄 Low' : '—'
}

type FilterTab = 'ALL' | 'OPEN' | 'CLOSED' | 'ELITE' | 'UPCOMING'
type SortOption = 'sub' | 'gain' | 'listing' | 'closing' | 'name'

const SORT_LABELS: Record<SortOption, string> = {
  sub: 'Highest Demand',
  gain: 'Highest Expected Gain',
  listing: 'Listing Soonest',
  closing: 'Closing Soonest',
  name: 'Name (A–Z)',
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Page                                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */
export function IposPage() {
  const { data: ipos, isLoading, error } = useUpcomingIpos()
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('sub')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const openIpos = ipos?.filter((i) => i.status === 'OPEN') ?? []
  const closedIpos = ipos?.filter((i) => i.status === 'CLOSED') ?? []
  const upcomingIpos = ipos?.filter((i) => i.status === 'UPCOMING') ?? []
  const eliteIpos = ipos?.filter((i) => i.isElite) ?? []

  let displayed = (ipos ?? []).filter((ipo) => {
    if (filterTab === 'OPEN') return ipo.status === 'OPEN'
    if (filterTab === 'CLOSED') return ipo.status === 'CLOSED'
    if (filterTab === 'UPCOMING') return ipo.status === 'UPCOMING'
    if (filterTab === 'ELITE') return ipo.isElite
    return true
  })

  displayed = [...displayed].sort((a, b) => {
    if (sortBy === 'sub') {
      const subA = (a.overallSubscription && a.overallSubscription > 0) ? a.overallSubscription : a.qibSubscription
      const subB = (b.overallSubscription && b.overallSubscription > 0) ? b.overallSubscription : b.qibSubscription
      return subB - subA
    }
    if (sortBy === 'gain') {
      const gainA = a.expectedListingGainPercent ?? a.gmpPercent ?? 0
      const gainB = b.expectedListingGainPercent ?? b.gmpPercent ?? 0
      return gainB - gainA
    }
    if (sortBy === 'listing') {
      const listA = a.daysToListing ?? 999
      const listB = b.daysToListing ?? 999
      return listA - listB
    }
    if (sortBy === 'closing') {
      const closeA = a.daysToClose ?? 999
      const closeB = b.daysToClose ?? 999
      return closeA - closeB
    }
    return a.symbol.localeCompare(b.symbol)
  })

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
            Live NSE data · subscription trends · QIB / NNI / Retail breakdown · Elite grade analysis (≥30×)
          </p>
        </div>

        {/* Sleek Guide Dialog */}
        <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <DialogTrigger className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-xs backdrop-blur-sm transition-all hover:bg-brand-100 hover:border-brand-300">
            <Sparkles size={13} className="text-brand-600" />
            Elite Grade Guide
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />
                IPO Elite Grade Classification
              </DialogTitle>
              <DialogDescription>
                Quantitative criteria used to identify high-probability listing opportunities
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-2 text-xs">
              <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5">
                <p className="font-bold text-purple-900 flex items-center gap-1.5">
                  <span>💎</span> Requirement: Overall Subscription ≥ 30×
                </p>
                <p className="mt-1 text-purple-800 leading-relaxed">
                  Only IPOs with $\ge$ 30× total demand (or institutional QIB $\ge$ 30×) qualify for the Elite Grade badge. Historical NSE data indicates that 30×+ oversubscription heavily correlates with premium listing gains.
                </p>
              </div>

              <div className="rounded-xl border border-ink-200/80 bg-ink-50/70 p-3.5 space-y-2">
                <p className="font-semibold text-ink-900">Demand Tiers:</p>
                <ul className="space-y-1.5 text-ink-600">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-purple-700 shrink-0">≥ 30×:</span>
                    <span><strong>Elite Grade:</strong> Massive multi-category conviction. High listing gain potential.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-up-700 shrink-0">10× – 29×:</span>
                    <span><strong>Mega Demand:</strong> Healthy institutional and retail interest.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-warn-700 shrink-0">&lt; 3×:</span>
                    <span><strong>Caution:</strong> Subdued interest; listing gain risk elevated.</span>
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                className="w-full sm:w-auto rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
                onClick={() => setIsGuideOpen(false)}
              >
                Got it
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* ── Sleek Filter Bar: Segmented Tabs & Sort Dropdown ── */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="ALL">
              All IPOs
              <span className="ml-1 rounded-md bg-ink-200/60 px-1.5 py-0.5 text-[10px] font-bold text-ink-700">
                {ipos?.length ?? 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="OPEN">
              🟢 Open
              <span className="ml-1 rounded-md bg-up-100 px-1.5 py-0.5 text-[10px] font-bold text-up-800">
                {openIpos.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="CLOSED">
              🏁 Awaiting Listing
              <span className="ml-1 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                {closedIpos.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ELITE">
              💎 Elite (≥30×)
              <span className="ml-1 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                {eliteIpos.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="UPCOMING">
              🕐 Upcoming
              <span className="ml-1 rounded-md bg-ink-200/60 px-1.5 py-0.5 text-[10px] font-bold text-ink-700">
                {upcomingIpos.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Sleek Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <SlidersHorizontal size={13} className="text-brand-600" />
            Sort: <span className="font-semibold text-ink-900">{SORT_LABELS[sortBy]}</span>
            <ChevronDown size={12} className="text-ink-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              icon={<TrendingUp size={13} className="text-brand-600" />}
              onClick={() => setSortBy('sub')}
            >
              Highest Demand
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Sparkles size={13} className="text-purple-600" />}
              onClick={() => setSortBy('gain')}
            >
              Highest Expected Gain
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<CalendarDays size={13} className="text-purple-600" />}
              onClick={() => setSortBy('listing')}
            >
              Listing Soonest
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<CalendarDays size={13} className="text-warn-600" />}
              onClick={() => setSortBy('closing')}
            >
              Closing Soonest
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<ArrowUpDown size={13} className="text-ink-500" />}
              onClick={() => setSortBy('name')}
            >
              Name (A–Z)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          <p>
            {filterTab === 'ELITE'
              ? 'No Elite Grade IPOs (≥30× subscription) found at this time.'
              : filterTab === 'OPEN'
              ? 'No open IPOs at this time.'
              : filterTab === 'CLOSED'
              ? 'No closed IPOs awaiting listing at this time.'
              : 'No upcoming IPOs found at this time.'}
          </p>
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
  const withSub = ipos.filter((i) => (i.overallSubscription ?? i.qibSubscription) > 0 || i.nniSubscription > 0 || i.retailSubscription > 0)
  if (!withSub.length) return null

  const data = withSub.map((ipo) => {
    const overall = (ipo.overallSubscription && ipo.overallSubscription > 0) ? ipo.overallSubscription : ipo.qibSubscription
    return {
      name: ipo.symbol.length > 10 ? ipo.symbol.slice(0, 10) + '…' : ipo.symbol,
      overall: overall > 0 ? overall : 0,
      QIB: ipo.qibSubscription > 0 && ipo.nniSubscription > 0 ? ipo.qibSubscription : 0,
      NNI: ipo.nniSubscription,
      Retail: ipo.retailSubscription,
      isElite: ipo.isElite,
    }
  })

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
            <ChartTooltip
              formatter={(v: any, name: any) => [`${fmt(Number(v), 2)}×`, name]}
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
        Purple = Elite Grade (≥30×) · Grey = Standard · Values = subscription multiples (×)
      </p>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Individual IPO Card                                                     */
/* ─────────────────────────────────────────────────────────────────────── */
function IpoCard({ ipo, expanded, onToggle }: { ipo: IpoDto; expanded: boolean; onToggle: () => void }) {
  const overallSub = (ipo.overallSubscription && ipo.overallSubscription > 0) ? ipo.overallSubscription : ipo.qibSubscription
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
        <UiTooltip content="Elite Grade: Subscription ≥ 30× with massive institutional conviction" className="w-full block">
          <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-500 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white cursor-help">
            <Sparkles size={11} className="animate-pulse" /> ELITE GRADE (≥30×) <Sparkles size={11} className="animate-pulse" />
          </div>
        </UiTooltip>
      )}

      {/* Header */}
      <div className={clsx('p-4', ipo.isElite ? '' : '')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                tone={ipo.status === 'OPEN' ? 'success' : ipo.status === 'CLOSED' ? 'info' : 'neutral'}
                size="sm"
              >
                {ipo.status === 'OPEN'
                  ? '🟢 Open'
                  : ipo.status === 'CLOSED'
                  ? '🏁 Closed · Listing'
                  : '🕐 Upcoming'}
              </Badge>
              {ipo.daysToClose !== null && ipo.status === 'OPEN' && (
                <span className="text-[11px] font-semibold text-warn-700">
                  {ipo.daysToClose === 0 ? 'Closes today!' : `${ipo.daysToClose}d left`}
                </span>
              )}
              {ipo.daysToListing !== null && ipo.daysToListing !== undefined && ipo.status === 'CLOSED' && (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  🗓️ {ipo.daysToListing === 0 ? 'Listing Today!' : `Listing in ${ipo.daysToListing}d`}
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

        {/* Closed IPO Listing Prediction Radar */}
        {ipo.status === 'CLOSED' && (
          <div className="mt-3 rounded-xl border border-purple-200/90 bg-gradient-to-br from-purple-50/70 via-white to-mint-50/40 p-3 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-600 flex items-center gap-1.5">
                <CalendarDays size={13} className="text-purple-600" />
                Expected Listing Date:
              </span>
              <span className="font-bold text-purple-900 bg-purple-100/90 px-2 py-0.5 rounded-md">
                {ipo.listingDate ? fmtDate(ipo.listingDate) : 'T+3 (Upcoming)'}
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-purple-100/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-ink-400">Issue / Cutoff</span>
                <p className="text-xs font-bold text-ink-800">₹{ipo.cutoffPrice || '—'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-purple-700">Expected Listing</span>
                <p className="text-sm font-extrabold text-up-700">
                  {ipo.expectedListingPrice ? `₹${ipo.expectedListingPrice}` : '—'}
                  {ipo.expectedListingGainPercent !== undefined && ipo.expectedListingGainPercent > 0 && (
                    <span className="ml-1 text-xs font-bold text-up-600">
                      (+{ipo.expectedListingGainPercent}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key info grid */}
        <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <InfoCell icon={<CalendarDays size={12} />} label="Open" value={fmtDate(ipo.openDate)} />
          <InfoCell icon={<CalendarDays size={12} />} label="Close" value={fmtDate(ipo.closeDate)} />
          {ipo.listingDate && (
            <InfoCell icon={<CalendarDays size={12} />} label="Listing Debut" value={fmtDate(ipo.listingDate)} />
          )}
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
                        <ChartTooltip formatter={(v: any) => [`${fmt(Number(v), 2)}×`]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
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
                        <ChartTooltip formatter={(v: any) => [`${fmt(Number(v), 2)}×`]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
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
  const overallSub = (ipo.overallSubscription && ipo.overallSubscription > 0) ? ipo.overallSubscription : ipo.qibSubscription
  const qib = ipo.qibSubscription
  const nni = ipo.nniSubscription
  const retail = ipo.retailSubscription

  const signals: { icon: string; text: string; tone: 'up' | 'warn' | 'down' | 'neutral' }[] = []

  if (overallSub >= 30) signals.push({ icon: '💎', text: `Elite oversubscription at ${fmt(overallSub, 1)}× (≥30×) — blockbuster listing expected`, tone: 'up' })
  else if (overallSub >= 10) signals.push({ icon: '🔥', text: `Mega oversubscription at ${fmt(overallSub, 1)}× — very strong listing likely`, tone: 'up' })
  else if (overallSub >= 3) signals.push({ icon: '💪', text: `Strong subscription ${fmt(overallSub, 1)}× — good listing expected`, tone: 'up' })
  else if (overallSub >= 1.5) signals.push({ icon: '📊', text: `Decent subscription ${fmt(overallSub, 1)}× — moderate interest`, tone: 'warn' })
  else if (overallSub > 0) signals.push({ icon: '⚠️', text: `Weak subscription ${fmt(overallSub, 1)}× — listing risk elevated`, tone: 'down' })

  if (qib >= 5 && nni > 0) signals.push({ icon: '🏦', text: `QIB ${fmt(qib, 1)}× + NNI ${fmt(nni, 1)}× — institutional conviction strong`, tone: 'up' })
  else if (qib >= 2) signals.push({ icon: '🏦', text: `QIB ${fmt(qib, 1)}× — institutions interested`, tone: 'up' })

  if (retail >= 2) signals.push({ icon: '👥', text: `Retail ${fmt(retail, 1)}× — strong retail participation`, tone: 'up' })

  if (ipo.status === 'CLOSED' && ipo.expectedListingPrice) {
    signals.push({
      icon: '🎯',
      text: `Closed with massive demand (${fmt(overallSub, 1)}×). Expected listing debut at ₹${ipo.expectedListingPrice} (+${ipo.expectedListingGainPercent}% over cutoff ₹${ipo.cutoffPrice || '—'}).`,
      tone: 'up',
    })
  }

  if (ipo.status === 'CLOSED' && ipo.daysToListing !== null && ipo.daysToListing !== undefined) {
    signals.push({
      icon: '📅',
      text:
        ipo.daysToListing === 0
          ? 'Lists on NSE/BSE TODAY! Watch pre-open order discovery at 9:00 AM.'
          : `Listing scheduled in ${ipo.daysToListing} business days (${fmtDate(ipo.listingDate || '')}) under SEBI T+3 rule.`,
      tone: 'neutral',
    })
  }

  if (ipo.status === 'OPEN') {
    if (ipo.daysToClose === 0) signals.push({ icon: '⏰', text: 'Last day to apply — closes today!', tone: 'warn' })
    else if (ipo.daysToClose === 1) signals.push({ icon: '⏰', text: 'Closes tomorrow — time running out', tone: 'warn' })
  }

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
