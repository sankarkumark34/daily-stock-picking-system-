import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertTriangle,
  Info,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { Badge, Skeleton } from '../components/ui'
import { usePreMarketWatchlist } from '../lib/api'
import type { PreMarketPickDto } from '@nse/shared'

export function PreMarketPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'INTRADAY' | 'BTST' | 'LONG' | 'SHORT'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('ALL')

  const { data: watchlistData, isLoading, error } = usePreMarketWatchlist()

  // Sectors list
  const sectors = useMemo(() => {
    if (!watchlistData?.picks) return ['ALL']
    const set = new Set(watchlistData.picks.map((p) => p.sector).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [watchlistData])

  // Filtered picks
  const filteredPicks = useMemo(() => {
    if (!watchlistData?.picks) return []
    return watchlistData.picks.filter((p) => {
      if (selectedSector !== 'ALL' && p.sector !== selectedSector) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!p.symbol.toLowerCase().includes(q) && !(p.name && p.name.toLowerCase().includes(q))) {
          return false
        }
      }
      if (activeTab === 'LONG') return p.direction === 'LONG'
      if (activeTab === 'SHORT') return p.direction === 'SHORT'
      if (activeTab === 'INTRADAY') return p.tradeType === 'INTRADAY'
      if (activeTab === 'BTST') return p.tradeType === 'BTST'
      return true
    })
  }, [watchlistData, activeTab, selectedSector, searchQuery])

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-[#DFE6F1] bg-white/70 p-6">
          <Skeleton className="h-8 w-72 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !watchlistData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center text-ink-900">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h2 className="text-lg font-bold text-red-900">Unable to load Pre-Market Watchlist</h2>
        <p className="mt-1 text-sm text-red-700">Please verify the API server is running and database is populated.</p>
      </div>
    )
  }

  const {
    asOfDate,
    nextTradeDate,
    marketSentiment,
    regime,
    picks,
    topSectors,
    longCount,
    shortCount,
    intradayCount,
    btstCount,
  } = watchlistData

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#DFE6F1] bg-white/70 p-6 shadow-xs backdrop-blur-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <p className="eyebrow-label text-[#7046E8] flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
              <Clock className="h-3.5 w-3.5" /> 9:15 AM – 9:30 AM OPENING DRIVE WATCHLIST
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0EBFF] text-[#7046E8] ring-1 ring-[#CFBAFF]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-ink-950 tracking-tight sm:text-2xl">
                  Pre-Market Trade Window
                </h1>
              </div>
              <Badge tone="info" size="md" className="font-semibold text-xs">
                Trading Session: {nextTradeDate}
              </Badge>
              <Badge tone={marketSentiment === 'BULLISH' ? 'success' : 'danger'} size="md" className="font-semibold text-xs">
                Market: {regime.replace('_', ' ')}
              </Badge>
            </div>
            <p className="max-w-2xl helper-text text-xs text-ink-600">
              Generated from EOD data on <strong>{asOfDate}</strong>. Focus trades strictly during the{' '}
              <strong className="text-[#7046E8]">9:15 – 9:30 AM opening 15-minute window</strong>. Check if live open
              fills within the specified entry zone before execution.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-0.5">
                <DollarSign className="h-3.5 w-3.5 text-amber-700" />
                Capital Sizing: ₹20,000 – ₹50,000
              </div>
              <p className="text-[11px] text-amber-800">
                Positions sized at <strong>~₹12,000 per trade</strong> with max risk capped below <strong>₹120</strong> (1% stop).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick KPI Stat Strip ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500">Total Opportunities</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-ink-950">{picks.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Screened from 400+ liquid stocks</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-up-700">BUY / Long Signals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-up-50 text-up-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-up-600">{longCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Breakouts, gap-ups & pullback setups</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-down-700">SELL / Short Signals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-down-50 text-down-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-down-600">{shortCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Breakdowns & overbought reversals</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7046E8]">Style Split</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0EBFF] text-[#7046E8]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-extrabold text-ink-900">
            {intradayCount} <span className="text-xs font-normal text-ink-500">Intraday</span> · {btstCount}{' '}
            <span className="text-xs font-normal text-ink-500">BTST</span>
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">Exit Intraday by 3:15 PM; hold BTST 1-day</p>
        </div>
      </div>

      {/* ── Sector Momentum Strip ── */}
      {topSectors && topSectors.length > 0 && (
        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-xs font-bold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#7046E8]" /> Sector Momentum Breakdown for {nextTradeDate}
            </p>
            <span className="text-[11px] text-ink-400">Ordered by signal density</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {topSectors.map((s) => (
              <div
                key={s.sector}
                onClick={() => setSelectedSector(selectedSector === s.sector ? 'ALL' : s.sector)}
                className={`cursor-pointer rounded-lg border p-2.5 transition-all text-xs ${
                  selectedSector === s.sector
                    ? 'border-[#7046E8] bg-[#F0EBFF]/60 shadow-xs'
                    : 'border-[#DFE6F1] bg-ink-50/50 hover:bg-ink-100/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                      s.bias === 'BULLISH'
                        ? 'bg-up-100 text-up-800'
                        : s.bias === 'BEARISH'
                          ? 'bg-down-100 text-down-800'
                          : 'bg-ink-200 text-ink-700'
                    }`}
                  >
                    {s.bias}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-ink-500">{s.pickCount} picks</span>
                </div>
                <p className="font-bold text-ink-900 truncate" title={s.sector}>
                  {s.sector}
                </p>
                {s.topPickSymbol && (
                  <p className="text-[10px] text-ink-500 mt-0.5">
                    Lead: <strong className="text-ink-800">{s.topPickSymbol}</strong>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters & Search ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DFE6F1] bg-white p-1.5 shadow-xs">
          {(
            [
              { id: 'ALL', label: `All (${watchlistData.picks.length})` },
              { id: 'LONG', label: `🟢 Buy / Long (${longCount})` },
              { id: 'SHORT', label: `🔴 Sell / Short (${shortCount})` },
              { id: 'INTRADAY', label: `⚡ Intraday (${intradayCount})` },
              { id: 'BTST', label: `🌙 BTST (${btstCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#7046E8] text-white shadow-xs'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sector dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search symbol or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#DFE6F1] bg-white py-1.5 pl-8 pr-3 text-xs text-ink-900 placeholder:text-ink-400 focus:border-[#7046E8] focus:outline-none focus:ring-1 focus:ring-[#7046E8]"
            />
          </div>

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="rounded-xl border border-[#DFE6F1] bg-white px-2.5 py-1.5 text-xs text-ink-700 focus:border-[#7046E8] focus:outline-none focus:ring-1 focus:ring-[#7046E8]"
          >
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec === 'ALL' ? 'All Sectors' : sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Watchlist Cards Grid ── */}
      {filteredPicks.length === 0 ? (
        <div className="rounded-2xl border border-[#DFE6F1] bg-white p-12 text-center">
          <Info className="mx-auto h-8 w-8 text-ink-400 mb-2" />
          <h3 className="font-bold text-ink-800">No stocks match current filter criteria</h3>
          <p className="text-xs text-ink-500 mt-1">Try switching tabs or resetting the sector filter.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredPicks.map((pick) => (
            <PreMarketCard key={pick.id} pick={pick} />
          ))}
        </div>
      )}
    </div>
  )
}

function PreMarketCard({ pick }: { pick: PreMarketPickDto }) {
  const isLong = pick.direction === 'LONG'

  // Build SVG sparkline path
  const sparklineSvg = useMemo(() => {
    if (!pick.sparkline || pick.sparkline.length < 2) return null
    const min = Math.min(...pick.sparkline)
    const max = Math.max(...pick.sparkline)
    const range = max - min || 1
    const w = 110
    const h = 32
    const pts = pick.sparkline.map((val, idx) => {
      const x = (idx / (pick.sparkline.length - 1)) * w
      const y = h - ((val - min) / range) * (h - 6) - 3
      return `${x},${y}`
    })
    return `M ${pts.join(' L ')}`
  }, [pick.sparkline])

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#DFE6F1] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#CFBAFF]">
      {/* Top row: Rank, Symbol, Badges */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${
                pick.rank <= 3
                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                  : 'bg-ink-100 text-ink-700'
              }`}
            >
              #{pick.rank}
            </span>
            <div>
              <Link
                to={`/stocks/${pick.symbol}`}
                className="font-black text-ink-950 text-base hover:text-[#7046E8] flex items-center gap-1 group"
              >
                {pick.symbol}
                <ChevronRight className="h-3.5 w-3.5 text-ink-400 group-hover:text-[#7046E8] transition-colors" />
              </Link>
              <p className="text-[11px] text-ink-500 truncate max-w-[170px]" title={pick.name ?? pick.symbol}>
                {pick.name ?? pick.sector}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                isLong
                  ? 'bg-up-100 text-up-800 border border-up-200'
                  : 'bg-down-100 text-down-800 border border-down-200'
              }`}
            >
              {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {pick.direction}
            </span>
            <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider bg-ink-100 px-1.5 py-0.5 rounded">
              {pick.tradeType}
            </span>
          </div>
        </div>

        {/* Signal Tag & Sparkline */}
        <div className="flex items-center justify-between border-y border-[#F0F3F8] py-2.5 my-2">
          <div>
            <span className="text-xs font-bold text-ink-800">{pick.signalLabel}</span>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-500">
              <span>RVOL: <strong className="text-ink-800">{pick.volSurgeMultiplier}×</strong></span>
              <span>·</span>
              <span>RSI: <strong className="text-ink-800">{pick.rsi}</strong></span>
            </div>
          </div>

          {sparklineSvg && (
            <div className="text-right">
              <svg width="110" height="32" className="overflow-visible inline-block">
                <path
                  d={sparklineSvg}
                  fill="none"
                  stroke={isLong ? '#079B73' : '#D9234F'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-[9.5px] text-ink-400">5-day price action</p>
            </div>
          )}
        </div>

        {/* Key Trade Levels (9:15 - 9:30 Window) */}
        <div className="rounded-xl border border-[#DFE6F1] bg-ink-50/50 p-3 my-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-500">
              Entry Range (9:15–9:30 AM)
            </span>
            <span className="font-mono text-xs font-extrabold text-[#7046E8] bg-[#F0EBFF] px-2 py-0.5 rounded">
              {pick.entryZone}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#DFE6F1]/70">
            <div>
              <span className="text-[10px] text-ink-400 block font-semibold">Target Price</span>
              <span className="font-mono text-xs font-black text-up-700">
                ₹{pick.targetPrice.toLocaleString('en-IN')}{' '}
                <span className="text-[10px] font-bold">({isLong ? '+' : '-'}{pick.targetPct}%)</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-ink-400 block font-semibold">Stop Loss</span>
              <span className="font-mono text-xs font-black text-down-700">
                ₹{pick.stopLossPrice.toLocaleString('en-IN')}{' '}
                <span className="text-[10px] font-bold">({isLong ? '-' : '+'}{pick.stopLossPct}%)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Small Capital Allocation Box (₹20k - ₹50k capital) */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-2.5 mb-3 text-xs text-blue-950">
          <div className="flex items-center justify-between font-bold text-[11px] mb-1">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-blue-700" /> Recommended Position
            </span>
            <span className="font-mono text-blue-800 font-extrabold">
              {pick.lotSize} shares (₹{pick.capitalRequired.toLocaleString('en-IN')})
            </span>
          </div>
          <div className="flex items-center justify-between text-[10.5px] text-blue-800">
            <span>
              Risk: <strong className="text-down-700">₹{pick.expectedMaxLoss}</strong>
            </span>
            <span>
              Potential: <strong className="text-up-700">₹{pick.expectedMaxGain}</strong>
            </span>
            <span>
              R:R: <strong>1:{pick.riskReward}</strong>
            </span>
          </div>
        </div>

        {/* Why Trade Catalysts */}
        <div className="space-y-1 my-2">
          {pick.reasons.slice(0, 2).map((r, i) => (
            <p key={i} className="text-[11px] text-ink-600 flex items-start gap-1.5 leading-snug">
              <span className="text-[#7046E8] font-bold">›</span> {r}
            </p>
          ))}
        </div>
      </div>

      {/* Footer link to full stock analysis */}
      <div className="mt-3 pt-2.5 border-t border-[#F0F3F8] flex items-center justify-between text-xs">
        <span className="text-[10.5px] text-ink-400 font-medium">
          Prev Close: <strong>₹{pick.prevClose}</strong>
        </span>
        <Link
          to={`/analyst/${pick.symbol}`}
          className="font-bold text-[#7046E8] hover:underline flex items-center gap-0.5 text-[11px]"
        >
          Detailed AI Analysis <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
