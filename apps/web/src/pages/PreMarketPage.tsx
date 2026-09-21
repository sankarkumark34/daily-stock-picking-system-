import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertTriangle,
  Info,
  ChevronRight,
  Layers,
  Flame,
  Star,
  Target,
  SlidersHorizontal,
} from 'lucide-react'
import { Badge, Skeleton } from '../components/ui'
import { usePreMarketWatchlist } from '../lib/api'
import type { PreMarketPickDto } from '@nse/shared'

export function PreMarketPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PRIORITY' | 'LONG' | 'SHORT' | 'INTRADAY' | 'BTST'>('PRIORITY')
  const [sortBy, setSortBy] = useState<'PROBABILITY' | 'RISK_REWARD' | 'VOLUME'>('PROBABILITY')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('ALL')

  const { data: watchlistData, isLoading, error } = usePreMarketWatchlist()

  // Sectors list
  const sectors = useMemo(() => {
    if (!watchlistData?.picks) return ['ALL']
    const set = new Set(watchlistData.picks.map((p) => p.sector).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [watchlistData])

  // Filtered and sorted picks
  const filteredPicks = useMemo(() => {
    if (!watchlistData?.picks) return []
    let result = watchlistData.picks.filter((p) => {
      if (selectedSector !== 'ALL' && p.sector !== selectedSector) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!p.symbol.toLowerCase().includes(q) && !(p.name && p.name.toLowerCase().includes(q))) {
          return false
        }
      }
      if (activeTab === 'PRIORITY') return p.priorityTier === 'TOP_FOCUS' || p.rank <= 5
      if (activeTab === 'LONG') return p.direction === 'LONG'
      if (activeTab === 'SHORT') return p.direction === 'SHORT'
      if (activeTab === 'INTRADAY') return p.tradeType === 'INTRADAY'
      if (activeTab === 'BTST') return p.tradeType === 'BTST'
      return true
    })

    if (sortBy === 'PROBABILITY') {
      result = [...result].sort((a, b) => b.winProbability - a.winProbability || b.confidenceScore - a.confidenceScore)
    } else if (sortBy === 'RISK_REWARD') {
      result = [...result].sort((a, b) => b.riskReward - a.riskReward)
    } else if (sortBy === 'VOLUME') {
      result = [...result].sort((a, b) => b.volSurgeMultiplier - a.volSurgeMultiplier)
    }

    return result
  }, [watchlistData, activeTab, selectedSector, searchQuery, sortBy])

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
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
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
    topPriorityPicks,
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
              <Flame className="h-3.5 w-3.5 text-amber-500" /> MAXIMUM PROBABILITY QUANT ENGINE
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0EBFF] text-[#7046E8] ring-1 ring-[#CFBAFF]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-ink-950 tracking-tight sm:text-2xl">
                  Pre-Market Priority Analyzer (9:15 – 9:30 AM)
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
              Analyzed from EOD bhavcopy on <strong>{asOfDate}</strong> · Ranked by <strong>Maximum Statistical Win Probability</strong>.
              In the first 15 minutes of trading (9:15 – 9:30 AM), focus strictly on <strong>Priority #1, #2, and #3</strong>. Validate if the opening print settles inside the recommended entry band.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-0.5">
                <DollarSign className="h-3.5 w-3.5 text-amber-700" />
                Capital Sizing: ₹20,000 – ₹50,000
              </div>
              <p className="text-[11px] text-amber-800">
                Positions allocated at <strong>~₹12,000 per trade</strong> with max loss strictly capped around <strong>₹90 – ₹120</strong> (0.9% stop).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 9:15 AM Execution Guide Strip ── */}
      <div className="rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-4 text-xs text-blue-950 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-blue-900 mb-2">
          <Target className="h-4 w-4 text-[#7046E8]" />
          <span>FAST 15-MINUTE EXECUTION PROTOCOL (9:15 – 9:30 AM IST)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-[11.5px]">
          <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-blue-100">
            <span className="font-black text-xs text-blue-600 bg-blue-100 rounded-full h-5 w-5 grid place-items-center shrink-0">1</span>
            <div>
              <p className="font-bold text-ink-900">9:08 AM Pre-Open Check</p>
              <p className="text-ink-600 text-[11px]">Confirm NSE discovery price settles within the highlighted Entry Zone.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-blue-100">
            <span className="font-black text-xs text-blue-600 bg-blue-100 rounded-full h-5 w-5 grid place-items-center shrink-0">2</span>
            <div>
              <p className="font-bold text-ink-900">9:15:05 AM Order Entry</p>
              <p className="text-ink-600 text-[11px]">Execute Limit or Market Order for Priority #1 stock with recommended lot size.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-blue-100">
            <span className="font-black text-xs text-blue-600 bg-blue-100 rounded-full h-5 w-5 grid place-items-center shrink-0">3</span>
            <div>
              <p className="font-bold text-ink-900">9:20 AM SL Placement</p>
              <p className="text-ink-600 text-[11px]">Place strict Stop-Loss order in terminal. Trail stop to breakeven once +1.2% in profit.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top 3 Priority Hero Showcase ── */}
      {topPriorityPicks && topPriorityPicks.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/40 to-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white shadow-xs">
                  <Flame className="h-4 w-4" />
                </span>
                <h2 className="text-base font-black text-ink-950 uppercase tracking-tight">
                  Prime Priority List — Highest Probability Setups
                </h2>
              </div>
              <p className="text-xs text-ink-600 mt-0.5">
                These 3 stocks have the highest confluence of volume surge, structural breakout, and favorable Risk:Reward.
              </p>
            </div>
            <Badge tone="warning" size="md" className="font-bold text-xs">
              ⚡ Action Window: 9:15 to 9:30 AM
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {topPriorityPicks.map((pick, idx) => (
              <TopPriorityCard key={pick.id} pick={pick} rankIndex={idx + 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Quick KPI Stat Strip ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500">Total Analyzed</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-ink-950">{picks.length} Candidates</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Selected from 400+ liquid equities</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-up-700">BUY / Long Signals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-up-50 text-up-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-up-600">{longCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Breakouts, gap-ups & dip setups</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-down-700">SELL / Short Signals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-down-50 text-down-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-down-600">{shortCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">Breakdowns & overbought fade trades</p>
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
          <p className="mt-0.5 text-[11px] text-ink-400">Intraday: square off by 3:15 PM</p>
        </div>
      </div>

      {/* ── Sector Momentum Breakdown ── */}
      {topSectors && topSectors.length > 0 && (
        <div className="rounded-xl border border-[#DFE6F1] bg-white p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">
              Sector Opening Bias ({nextTradeDate})
            </span>
            <span className="text-[11px] text-ink-400">Click sector to filter</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {topSectors.map((s) => (
              <div
                key={s.sector}
                onClick={() => setSelectedSector(selectedSector === s.sector ? 'ALL' : s.sector)}
                className={`cursor-pointer rounded-lg border p-2 text-xs transition-all ${selectedSector === s.sector
                  ? 'border-[#7046E8] bg-[#F0EBFF]/60 shadow-xs'
                  : 'border-[#DFE6F1] bg-ink-50/50 hover:bg-ink-100/50'
                  }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`font-semibold text-[10px] px-1.5 py-0.2 rounded ${s.bias === 'BULLISH'
                      ? 'bg-up-100 text-up-800'
                      : s.bias === 'BEARISH'
                        ? 'bg-down-100 text-down-800'
                        : 'bg-ink-200 text-ink-700'
                      }`}
                  >
                    {s.bias}
                  </span>
                  <span className="font-mono text-[10.5px] font-bold text-ink-500">{s.pickCount} picks</span>
                </div>
                <p className="font-bold text-ink-900 truncate text-[11.5px]" title={s.sector}>
                  {s.sector}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters & Controls ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DFE6F1] bg-white p-1.5 shadow-xs">
          {(
            [
              { id: 'PRIORITY', label: `🔥 High Probability Priority (${topPriorityPicks?.length || 5})` },
              { id: 'ALL', label: `All Candidates (${picks.length})` },
              { id: 'LONG', label: `🟢 Long / Buy (${longCount})` },
              { id: 'SHORT', label: `🔴 Short / Sell (${shortCount})` },
              { id: 'INTRADAY', label: `⚡ Intraday (${intradayCount})` },
              { id: 'BTST', label: `🌙 BTST (${btstCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${activeTab === tab.id
                ? 'bg-[#7046E8] text-white shadow-xs'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort & Search & Sector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-[#DFE6F1] rounded-xl px-2.5 py-1 text-xs">
            <SlidersHorizontal className="h-3 w-3 text-ink-400" />
            <span className="text-ink-500 text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-ink-800 font-semibold focus:outline-none text-xs cursor-pointer"
            >
              <option value="PROBABILITY">Highest Probability</option>
              <option value="RISK_REWARD">Best Risk/Reward</option>
              <option value="VOLUME">Highest Volume (RVOL)</option>
            </select>
          </div>

          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Filter symbol…"
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

function TopPriorityCard({ pick, rankIndex }: { pick: PreMarketPickDto; rankIndex: number }) {
  const isLong = pick.direction === 'LONG'

  return (
    <div className="flex flex-col justify-between rounded-xl border-2 border-amber-300 bg-white p-4 shadow-sm hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 px-2 items-center justify-center rounded-md bg-amber-500 text-white font-black text-xs shadow-xs">
              #{rankIndex} PRIORITY
            </span>
            <span className="font-extrabold text-base text-ink-950 hover:text-[#7046E8]">
              <Link to={`/stocks/${pick.symbol}`}>{pick.symbol}</Link>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`font-black text-xs px-2 py-0.5 rounded-full ${isLong ? 'bg-up-100 text-up-800' : 'bg-down-100 text-down-800'
                }`}
            >
              {isLong ? 'BUY' : 'SHORT'}
            </span>
            <span className="bg-amber-100 text-amber-900 font-extrabold text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-600" />
              {pick.winProbability}% Win Prob
            </span>
          </div>
        </div>

        <p className="text-[11px] text-ink-500 truncate mb-2">{pick.name ?? pick.sector}</p>

        {/* Entry & Targets Highlight */}
        <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-2.5 space-y-1.5 my-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-900">9:15 AM Entry Range:</span>
            <span className="font-mono font-black text-amber-950 bg-white px-2 py-0.5 rounded shadow-2xs">
              {pick.entryZone}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-amber-200/60">
            <div>
              <span className="text-[10px] text-ink-500 block">Target ({isLong ? '+' : '-'}{pick.targetPct}%)</span>
              <span className="font-mono font-black text-up-700">₹{pick.targetPrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-ink-500 block">Stop-Loss ({isLong ? '-' : '+'}{pick.stopLossPct}%)</span>
              <span className="font-mono font-black text-down-700">₹{pick.stopLossPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Sizing box */}
        <div className="flex items-center justify-between text-[11px] bg-ink-50 rounded-lg p-2 my-2 text-ink-700">
          <span>
            Qty: <strong className="text-ink-900 font-mono">{pick.lotSize} shs</strong> (₹{pick.capitalRequired.toLocaleString('en-IN')})
          </span>
          <span>
            Risk: <strong className="text-down-700">₹{pick.expectedMaxLoss}</strong> · R:R <strong>1:{pick.riskReward}</strong>
          </span>
        </div>

        {/* Primary reason bullet */}
        <p className="text-[11px] text-ink-700 leading-snug line-clamp-2 mt-2">
          <span className="text-amber-600 font-bold">›</span> {pick.reasons[0]}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-ink-100 flex items-center justify-between text-xs">
        <span className="text-[10.5px] text-ink-400">RVOL: <strong>{pick.volSurgeMultiplier}×</strong> · RSI: <strong>{pick.rsi}</strong></span>
        <Link to={`/analyst/${pick.symbol}`} className="font-bold text-[#7046E8] hover:underline flex items-center gap-0.5 text-[11px]">
          Full Analysis <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

function PreMarketCard({ pick }: { pick: PreMarketPickDto }) {
  const isLong = pick.direction === 'LONG'
  const isPriority = pick.rank <= 3

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
    <div
      className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${isPriority
        ? 'border-amber-300 ring-1 ring-amber-200/80 hover:border-amber-400'
        : 'border-[#DFE6F1] hover:border-[#CFBAFF]'
        }`}
    >
      {/* Top row: Rank, Symbol, Probability Gauge, Badges */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${isPriority
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
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${isLong
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

        {/* Probability Meter & Ranking Badge */}
        <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 px-3 py-2 my-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-600" />
            <span className="text-xs font-black text-amber-950">
              {pick.winProbability}% Win Probability
            </span>
          </div>
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pick.priorityTier === 'TOP_FOCUS'
              ? 'bg-amber-500 text-white shadow-2xs'
              : pick.priorityTier === 'HIGH'
                ? 'bg-indigo-600 text-white'
                : 'bg-ink-200 text-ink-700'
              }`}
          >
            {pick.priorityTier === 'TOP_FOCUS' ? 'Priority #1 Focus' : pick.priorityTier === 'HIGH' ? 'High Conviction' : 'Standard'}
          </span>
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
