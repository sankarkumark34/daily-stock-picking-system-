import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  Compass,
  Search,
  ArrowUpRight,
  DollarSign,
  AlertTriangle,
  Info,
  ChevronRight,
  Flame,
  Star,
  Target,
  Shield,
  CheckCircle2,
  BookOpen,
  Zap,
  Table as TableIcon,
  LayoutGrid,
  X,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { Badge, Skeleton } from '../components/ui'
import { useSwingRadar } from '../lib/api'
import type { SwingTradingPickDto } from '@nse/shared'

const STRATEGY_FILTERS: { label: string; value: string; desc: string }[] = [
  { label: 'All Setups', value: 'ALL', desc: 'All high-confluence 10-day swing setups' },
  { label: 'Strategy A: EMA Pullback', value: 'EMA_PULLBACK', desc: 'Core #1: Dip buy near 20-EMA with low volume' },
  { label: 'Strategy B: Vol Breakout', value: 'VOLUME_BREAKOUT', desc: 'Core #2: 3-8W tight base breakout on 1.5-2x volume' },
  { label: 'Minervini VCP (#10)', value: 'MINERVINI_VCP', desc: 'Stage 2 volatility contraction pivot breakout' },
  { label: 'NR7 / Inside Bar (#9)', value: 'NR7_INSIDE_BAR', desc: 'Narrow range contraction before explosive move' },
  { label: 'Supertrend Rider (#3)', value: 'SUPERTREND_RIDER', desc: 'Bullish Supertrend with ADX > 22 confirmation' },
  { label: 'Delivery Surge (#23)', value: 'DELIVERY_SURGE', desc: 'Institutional delivery % accumulation spike' },
]

export function SwingPage() {
  // Filters & State
  const [activeStrategy, setActiveStrategy] = useState<string>('ALL')
  const [minRR, setMinRR] = useState<number>(2.0)
  const [selectedSector, setSelectedSector] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS')
  const [selectedPick, setSelectedPick] = useState<SwingTradingPickDto | null>(null)
  const [showPlaybook, setShowPlaybook] = useState(false)

  // Interactive Position Sizing Settings
  const [userCapital, setUserCapital] = useState<number>(500_000)
  const [userRiskPct, setUserRiskPct] = useState<number>(1.0)

  // Query Hook
  const { data: radarData, isLoading, error } = useSwingRadar({
    strategy: activeStrategy,
    minRR,
    sector: selectedSector,
    capital: userCapital,
    riskPct: userRiskPct,
    search: searchQuery,
  })

  // Sectors list
  const sectors = useMemo(() => {
    if (!radarData?.sectorRankings) return ['ALL']
    return ['ALL', ...radarData.sectorRankings.map((s) => s.sector)]
  }, [radarData])

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

  if (error || !radarData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center text-ink-900">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h2 className="text-lg font-bold text-red-900">Unable to load 10-Day Swing Radar</h2>
        <p className="mt-1 text-sm text-red-700">Please verify the API server is running and database is populated.</p>
      </div>
    )
  }

  const {
    asOfDate,
    marketRegime,
    niftyStatus,
    recommendedStrategyFocus,
    focusReason,
    totalStocksScanned,
    picksCount,
    avgRiskReward,
    avgWinProbability,
    avgConfluenceScore,
    topPrimePicks,
    picks,
    sectorRankings,
  } = radarData

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#DFE6F1] bg-white/80 p-6 shadow-xs backdrop-blur-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0EBFF] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#7046E8]">
                <Compass className="h-3.5 w-3.5" /> 10-DAY SWING RADAR (NSE CASH & DELIVERY)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 ring-1 ring-amber-200">
                <Clock className="h-3 w-3" /> Hold Horizon: ~10 Working Days
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-ink-950 sm:text-2xl">
                Swing Trading Engine & Stock Picker
              </h1>
              <Badge tone="info" size="md" className="font-semibold text-xs">
                As of {asOfDate}
              </Badge>
              <Badge tone={marketRegime.includes('BULL') ? 'success' : 'warning'} size="md" className="font-semibold text-xs">
                Market: {marketRegime.replace('_', ' ')}
              </Badge>
            </div>

            <p className="max-w-2xl helper-text text-xs text-ink-600 leading-relaxed">
              Personal reference trading system focusing on a <strong>~10 working days (2 weeks)</strong> hold. Strict mathematical rules:
              minimum <strong>1:2.0 Risk:Reward</strong>, ATR-buffered stops, and multi-factor technical confluence.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPlaybook(!showPlaybook)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFE6F1] bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-[#F0EBFF] hover:text-[#7046E8] hover:border-[#CFBAFF] transition-all shadow-2xs"
            >
              <BookOpen className="h-4 w-4 text-[#7046E8]" />
              {showPlaybook ? 'Hide Playbook Rules' : 'Strategy Playbook Rules'}
            </button>
          </div>
        </div>

        {/* ── Market Regime & Strategy Guidance Ribbon ── */}
        <div className="mt-5 rounded-xl border border-white/60 bg-gradient-to-r from-[#F8FAFF] to-[#F3EEFF] p-3.5 text-xs text-ink-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#7046E8] text-white">
                <Flame size={15} />
              </span>
              <div>
                <span className="font-bold text-ink-900">Recommended Strategy Focus: </span>
                <span className="font-extrabold text-[#7046E8]">
                  {recommendedStrategyFocus === 'VOLUME_BREAKOUT'
                    ? 'Strategy B: Volume Breakout + Minervini VCP'
                    : recommendedStrategyFocus === 'EMA_PULLBACK'
                    ? 'Strategy A: EMA Pullback (Dip Buys)'
                    : 'Defensive / High-RS Selective'}
                </span>
                <span className="text-ink-500 block text-[11px] mt-0.5">{focusReason}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-[11px]">
              <div className="rounded-lg bg-white/80 px-2.5 py-1.5 border border-[#DFE6F1]">
                <span className="text-ink-500">NIFTY 50: </span>
                <span className="font-bold text-ink-900 tnum">{niftyStatus.close.toLocaleString('en-IN')}</span>
                <span className={`ml-1 font-bold ${niftyStatus.changePct >= 0 ? 'text-up-600' : 'text-down-600'}`}>
                  {niftyStatus.changePct >= 0 ? '+' : ''}{niftyStatus.changePct}%
                </span>
              </div>
              <div className="rounded-lg bg-white/80 px-2.5 py-1.5 border border-[#DFE6F1]">
                <span className="text-ink-500">50 EMA: </span>
                <span className="font-bold text-ink-900 tnum">{niftyStatus.ema50.toLocaleString('en-IN')}</span>
                <span className={`ml-1 font-bold ${niftyStatus.isAbove50Ema ? 'text-up-600' : 'text-warn-600'}`}>
                  ({niftyStatus.isAbove50Ema ? 'Above' : 'Below'})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Strategy Playbook Accordion (Collapsible User Guide) ── */}
      {showPlaybook && (
        <div className="rounded-2xl border border-[#CFBAFF] bg-[#FAF8FF] p-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#E3D7FF] pb-3 mb-4">
            <h2 className="text-sm font-extrabold text-ink-950 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#7046E8]" /> 10-Day Swing Strategy Playbook & Rules
            </h2>
            <button
              type="button"
              onClick={() => setShowPlaybook(false)}
              className="text-xs text-ink-400 hover:text-ink-800"
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 text-xs leading-relaxed">
            {/* Common Rules */}
            <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2">
              <p className="font-bold text-ink-900 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#7046E8]" /> Common Rules (Mandatory)
              </p>
              <ul className="list-disc pl-4 space-y-1 text-ink-600 text-[11.5px]">
                <li><strong>Position sizing:</strong> Quantity = (Capital × Risk%) ÷ (Entry − Stop Loss).</li>
                <li><strong>Risk:Reward:</strong> Minimum 1:2.0. Never enter a trade below 1:2.</li>
                <li><strong>Stop loss:</strong> Chart level (swing low, 20 EMA, base low) + 1.0-1.5× ATR noise buffer.</li>
                <li><strong>Delivery CNC:</strong> Cash delivery only (no intraday MIS forced square-off).</li>
                <li><strong>Market Trend:</strong> Verify Nifty 50 relative to 50 EMA.</li>
              </ul>
            </div>

            {/* Strategy A */}
            <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2">
              <p className="font-bold text-ink-900 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-up-600" /> Strategy A: EMA Pullback
              </p>
              <ul className="list-disc pl-4 space-y-1 text-ink-600 text-[11.5px]">
                <li><strong>Idea:</strong> Buy dip in strong uptrend when price touches 20-EMA on dry volume.</li>
                <li><strong>Filter:</strong> Price &gt; 50 EMA, 20 EMA &gt; 50 EMA (both rising), RS &gt; Nifty.</li>
                <li><strong>Entry:</strong> Hammer or engulfing bounce candle; buy on breakout of candle high.</li>
                <li><strong>Target:</strong> T1: Previous swing high (book 50%); T2: 10-day runner.</li>
                <li><strong>Exit:</strong> Day 5-6 sideways time stop; close below 20-EMA exit.</li>
              </ul>
            </div>

            {/* Strategy B */}
            <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2">
              <p className="font-bold text-ink-900 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" /> Strategy B: Volume Breakout
              </p>
              <ul className="list-disc pl-4 space-y-1 text-ink-600 text-[11.5px]">
                <li><strong>Idea:</strong> 3-8 week tight base breakout on institutional volume (1.5-2× avg).</li>
                <li><strong>Filter:</strong> Base depth 10-15%, price within 10% of 52WH, RS line uptrending.</li>
                <li><strong>Close:</strong> Candle closes in upper 25% of the day's range.</li>
                <li><strong>Target:</strong> Measured move (base height added to breakout level).</li>
                <li><strong>Exit:</strong> Fake breakout exit if price closes back inside base within 3 days.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Key Summary Metrics ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DFE6F1] bg-white/70 p-4 shadow-xs backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Total Scanned Stocks</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-ink-950 tnum">{totalStocksScanned.toLocaleString()}</span>
            <span className="text-xs font-semibold text-ink-500">Liquid NSE Cash</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">Turnover &gt; ₹1.5 Cr &amp; price &gt; ₹30</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white/70 p-4 shadow-xs backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Qualified 10-Day Setups</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#7046E8] tnum">{picksCount}</span>
            <Badge tone="violet" size="sm">
              Passed 6/6 Filters
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">R:R &gt;= 1:2.0 &amp; 10D Feasible</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white/70 p-4 shadow-xs backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Average Risk:Reward</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-up-700 tnum">1:{avgRiskReward}</span>
            <span className="text-xs font-bold text-up-600">Asymmetric</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">Min 1:2 rule strictly enforced</p>
        </div>

        <div className="rounded-xl border border-[#DFE6F1] bg-white/70 p-4 shadow-xs backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">Avg Confluence Win Prob</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-ink-950 tnum">{avgWinProbability}%</span>
            <Badge tone="success" size="sm">
              Score ~{avgConfluenceScore}/100
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">Calibrated multi-factor edge</p>
        </div>
      </div>

      {/* ── Interactive Position Sizing Bar (God-Level Feature) ── */}
      <div className="rounded-2xl border border-[#DFE6F1] bg-white/80 p-5 shadow-xs backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-extrabold text-ink-900 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-[#7046E8]" /> Position Sizing Calculator (Capital &amp; Risk Adjuster)
            </p>
            <p className="text-[11px] text-ink-500">
              Formula: <code>Quantity = (Capital × Risk%) ÷ (Entry − Stop Loss)</code>. Updates share counts &amp; targets live for all picks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Capital Input & Quick Chips */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-600">Capital:</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">₹</span>
                <input
                  type="number"
                  value={userCapital}
                  onChange={(e) => setUserCapital(Math.max(10_000, Number(e.target.value) || 0))}
                  step={50_000}
                  className="w-28 rounded-lg border border-[#DFE6F1] py-1 pl-6 pr-2 text-xs font-bold text-ink-900 focus:border-[#7046E8] focus:outline-hidden"
                />
              </div>
              <div className="hidden sm:flex items-center gap-1">
                {[200_000, 500_000, 1_000_000, 2_500_000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setUserCapital(amt)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                      userCapital === amt ? 'bg-[#7046E8] text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                    }`}
                  >
                    {amt >= 100_000 ? `₹${amt / 100_000}L` : `₹${amt}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk % Input & Quick Chips */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-600">Risk/Trade:</label>
              <div className="relative">
                <input
                  type="number"
                  value={userRiskPct}
                  onChange={(e) => setUserRiskPct(Math.max(0.25, Math.min(5, Number(e.target.value) || 1)))}
                  step={0.5}
                  className="w-16 rounded-lg border border-[#DFE6F1] py-1 px-2 text-xs font-bold text-ink-900 text-right pr-6 focus:border-[#7046E8] focus:outline-hidden"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">%</span>
              </div>
              <div className="flex items-center gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setUserRiskPct(pct)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
                      userRiskPct === pct ? 'bg-[#7046E8] text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-[#F0EBFF] px-3 py-1 text-[11px] font-extrabold text-[#7046E8] border border-[#CFBAFF]">
              Max Risk: ₹{Math.round((userCapital * userRiskPct) / 100).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top 3 Prime 10-Day Focus Showcase ── */}
      {topPrimePicks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink-950 uppercase tracking-wider flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              Prime 10-Day Focus (Highest Confluence Setups)
            </h2>
            <span className="text-xs text-ink-500">Ranked by mathematical edge</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {topPrimePicks.map((pick) => (
              <PrimeFocusCard
                key={pick.id}
                pick={pick}
                onSelect={() => setSelectedPick(pick)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Strategy Filters & Control Bar ── */}
      <div className="space-y-3">
        {/* Leading Sectors Strip */}
        {sectorRankings && sectorRankings.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="font-bold text-ink-500 uppercase tracking-wider text-[10px] shrink-0 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-up-600" /> Leading Sectors:
            </span>
            {sectorRankings.slice(0, 6).map((sec) => (
              <button
                key={sec.sector}
                type="button"
                onClick={() => setSelectedSector(selectedSector === sec.sector ? 'ALL' : sec.sector)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0 border ${
                  selectedSector === sec.sector
                    ? 'bg-[#7046E8] text-white border-[#7046E8]'
                    : 'bg-white/80 text-ink-700 border-[#DFE6F1] hover:bg-[#F0EBFF]'
                }`}
              >
                <span>{sec.sector}</span>
                <span className={`text-[10px] font-bold ${selectedSector === sec.sector ? 'text-white/90' : 'text-up-600'}`}>
                  {sec.relativeStrengthScore >= 0 ? '+' : ''}{sec.relativeStrengthScore}%
                </span>
                <span className="rounded-full bg-black/10 px-1 py-0.2 text-[9px]">
                  {sec.pickCount}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Strategy Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#DFE6F1] pb-2">
          {STRATEGY_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setActiveStrategy(s.value)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                activeStrategy === s.value
                  ? 'bg-[#7046E8] text-white shadow-xs'
                  : 'bg-white/60 text-ink-600 hover:bg-white hover:text-ink-900 border border-[#DFE6F1]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-3 rounded-xl border border-[#DFE6F1] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              <input
                type="text"
                placeholder="Search stock symbol or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#DFE6F1] py-1.5 pl-8 pr-2.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-[#7046E8] focus:outline-hidden"
              />
            </div>

            {/* Min Risk:Reward */}
            <div className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="font-semibold text-[11px]">Min R:R:</span>
              {[2.0, 2.5, 3.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMinRR(r)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    minRR === r ? 'bg-up-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                  }`}
                >
                  1:{r}+
                </button>
              ))}
            </div>

            {/* Sector Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-ink-600 text-[11px]">Sector:</span>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="rounded-lg border border-[#DFE6F1] bg-white py-1.5 px-2 text-xs font-medium text-ink-800 focus:border-[#7046E8] focus:outline-hidden"
              >
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 border border-[#DFE6F1] p-0.5 rounded-lg bg-white shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`p-1.5 rounded-md ${viewMode === 'CARDS' ? 'bg-[#F0EBFF] text-[#7046E8]' : 'text-ink-400 hover:text-ink-700'}`}
              title="Card View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-md ${viewMode === 'TABLE' ? 'bg-[#F0EBFF] text-[#7046E8]' : 'text-ink-400 hover:text-ink-700'}`}
              title="Table View"
            >
              <TableIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Picks Results List (Cards or Table) ── */}
      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DFE6F1] bg-white/50 p-12 text-center text-ink-500">
          <Info className="mx-auto h-8 w-8 text-ink-400 mb-2" />
          <p className="text-sm font-bold text-ink-800">No stocks matching the selected criteria</p>
          <p className="mt-1 text-xs text-ink-500">Try adjusting the strategy tab, lower minimum R:R, or clearing the sector filter.</p>
        </div>
      ) : viewMode === 'CARDS' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <PickCard key={pick.id} pick={pick} onSelect={() => setSelectedPick(pick)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DFE6F1] bg-white/80 shadow-xs backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DFE6F1] bg-[#F8FAFF] text-ink-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rank &amp; Symbol</th>
                  <th className="py-3 px-3">Strategy</th>
                  <th className="py-3 px-3 text-right">LTP / Entry</th>
                  <th className="py-3 px-3 text-right">Stop Loss</th>
                  <th className="py-3 px-3 text-right">Target 1 (50%)</th>
                  <th className="py-3 px-3 text-right">R:R</th>
                  <th className="py-3 px-3 text-center">Suggested Qty</th>
                  <th className="py-3 px-3 text-center">Est. Days</th>
                  <th className="py-3 px-3 text-center">Win Prob</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE6F1]/70">
                {picks.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F0EBFF]/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-ink-400 tnum text-[11px]">#{p.rank}</span>
                        <div>
                          <Link to={`/stocks/${p.symbol}`} className="font-bold text-ink-950 hover:text-[#7046E8] transition-colors">
                            {p.symbol}
                          </Link>
                          <span className="block text-[10.5px] text-ink-500 truncate max-w-[130px]">{p.sector}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1.5">
                        <Badge
                          tone={
                            p.strategyTag === 'STRATEGY_A'
                              ? 'success'
                              : p.strategyTag === 'STRATEGY_B'
                              ? 'warning'
                              : 'violet'
                          }
                          size="sm"
                        >
                          {p.strategy.replace('_', ' ')}
                        </Badge>
                        <SetupInfoHover pick={p} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold tnum text-ink-900">
                      ₹{p.entry.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right tnum font-semibold text-down-600">
                      ₹{p.stopLoss.toFixed(2)}
                      <span className="block text-[10px] text-ink-400">-{p.stopLossPct}%</span>
                    </td>
                    <td className="py-3 px-3 text-right tnum font-semibold text-up-700">
                      ₹{p.target1.toFixed(2)}
                      <span className="block text-[10px] text-up-600">+{p.target1Pct}%</span>
                    </td>
                    <td className="py-3 px-3 text-right tnum font-extrabold text-ink-900">
                      1:{p.riskReward}
                    </td>
                    <td className="py-3 px-3 text-center tnum">
                      <span className="font-bold text-ink-900">{p.positionSizing.suggestedQty} shs</span>
                      <span className="block text-[10px] text-ink-500">₹{p.positionSizing.tradeValue.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700 text-[10.5px]">
                        {p.expectedDaysToTarget}d
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-extrabold text-up-700 tnum">{p.winProbability}%</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedPick(p)}
                        className="rounded-lg bg-[#F0EBFF] px-2.5 py-1 text-[11px] font-bold text-[#7046E8] hover:bg-[#E3D7FF] transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Deep Dive Modal for Selected Pick ── */}
      {selectedPick && (
        <PickDetailModal
          pick={selectedPick}
          onClose={() => setSelectedPick(null)}
        />
      )}
    </div>
  )
}

/* =========================================================================
   PRIME FOCUS CARD (TOP 3 SHOWCASE)
   ========================================================================= */
function PrimeFocusCard({
  pick,
  onSelect,
}: {
  pick: SwingTradingPickDto
  onSelect: () => void
}) {
  const p = pick
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#CFBAFF] bg-gradient-to-b from-white to-[#FAF8FF] p-5 shadow-sm transition-all hover:shadow-md hover:border-[#7046E8]">
      {/* Glow Top Accent */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#7046E8]/10 blur-xl pointer-events-none" />

      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 border-b border-[#DFE6F1] pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-[#F0EBFF] px-2 py-0.5 text-[10px] font-extrabold text-[#7046E8]">
                #{p.rank} PRIME
              </span>
              <Badge
                tone={
                  p.strategyTag === 'STRATEGY_A'
                    ? 'success'
                    : p.strategyTag === 'STRATEGY_B'
                    ? 'warning'
                    : 'violet'
                }
                size="sm"
              >
                {p.strategyTag === 'STRATEGY_A'
                  ? 'Strategy A: Pullback'
                  : p.strategyTag === 'STRATEGY_B'
                  ? 'Strategy B: Breakout'
                  : p.strategy.replace('_', ' ')}
              </Badge>
              <SetupInfoHover pick={p} />
            </div>
            <Link to={`/stocks/${p.symbol}`} className="mt-1 block text-base font-extrabold text-ink-950 hover:text-[#7046E8] transition-colors">
              {p.symbol}
            </Link>
            <p className="text-[11px] text-ink-500 truncate max-w-[200px]">{p.name || p.sector}</p>
          </div>

          <div className="text-right">
            <span className="text-xs font-extrabold text-up-700 bg-up-50 px-2 py-0.5 rounded-full border border-up-200">
              {p.winProbability}% Win Prob
            </span>
            <p className="mt-1 text-[11px] font-bold text-ink-900 tnum">₹{p.technical.close.toFixed(2)}</p>
            <span className={`text-[10px] font-semibold ${p.technical.changePct >= 0 ? 'text-up-600' : 'text-down-600'}`}>
              {p.technical.changePct >= 0 ? '+' : ''}{p.technical.changePct}%
            </span>
          </div>
        </div>

        {/* Visual Risk:Reward Bar */}
        <div className="my-3.5 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-down-600">SL: ₹{p.stopLoss.toFixed(2)} (-{p.stopLossPct}%)</span>
            <span className="text-ink-800">R:R 1:{p.riskReward}</span>
            <span className="text-up-700">T1: ₹{p.target1.toFixed(2)} (+{p.target1Pct}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink-100 flex overflow-hidden">
            <div className="bg-down-500 h-full" style={{ width: '25%' }} title="Risk (SL Zone)" />
            <div className="bg-[#7046E8] h-full" style={{ width: '8%' }} title="Entry Zone" />
            <div className="bg-up-500 h-full" style={{ width: '67%' }} title="Reward (Target Zone)" />
          </div>
          <div className="flex justify-between text-[10px] text-ink-400">
            <span>{p.stopLossType}</span>
            <span>Target 2: ₹{p.target2.toFixed(2)} (+{p.target2Pct}%)</span>
          </div>
        </div>

        {/* Position Sizing Summary Card */}
        <div className="rounded-xl border border-[#E3D7FF] bg-[#F5F0FF] p-3 text-[11px] space-y-1">
          <div className="flex justify-between font-bold text-ink-900">
            <span>Position Size:</span>
            <span className="text-[#7046E8] font-extrabold">{p.positionSizing.suggestedQty} shares</span>
          </div>
          <div className="flex justify-between text-ink-600 text-[10.5px]">
            <span>Capital Outlay:</span>
            <span className="font-semibold text-ink-900">₹{p.positionSizing.tradeValue.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-[10.5px]">
            <span className="text-down-600">Max Risk: -₹{p.positionSizing.maxLoss.toLocaleString('en-IN')}</span>
            <span className="text-up-700 font-bold">Target 1 Gain: +₹{p.positionSizing.target1Profit.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* 10-Day Feasibility & Horizon */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-ink-600">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Est. Days to T1: <strong className="text-ink-900">{p.expectedDaysToTarget} days</strong>
          </span>
          <span className="rounded bg-up-50 text-up-700 px-2 py-0.5 text-[10px] font-bold border border-up-200">
            {p.tenDayTargetFeasibility} FEASIBILITY
          </span>
        </div>
      </div>

      {/* Footer Action */}
      <div className="mt-4 pt-3 border-t border-[#DFE6F1] flex items-center justify-between">
        <span className="text-[10px] text-ink-400 font-medium">6/6 Checklist Passed</span>
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#7046E8] hover:text-[#5B33CC] transition-colors"
        >
          View Full Plan <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   STANDARD PICK CARD
   ========================================================================= */
function PickCard({
  pick,
  onSelect,
}: {
  pick: SwingTradingPickDto
  onSelect: () => void
}) {
  const p = pick
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#DFE6F1] bg-white/80 p-4 shadow-xs backdrop-blur-xl transition-all hover:shadow-md hover:border-[#CFBAFF]">
      <div>
        {/* Top bar */}
        <div className="flex items-start justify-between border-b border-[#DFE6F1]/70 pb-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-ink-400 tnum">#{p.rank}</span>
              <Link to={`/stocks/${p.symbol}`} className="font-extrabold text-sm text-ink-950 hover:text-[#7046E8] transition-colors">
                {p.symbol}
              </Link>
            </div>
            <p className="text-[10.5px] text-ink-500 truncate max-w-[180px]">{p.name || p.sector}</p>
          </div>

          <div className="text-right">
            <span className="text-xs font-extrabold text-ink-950 tnum">₹{p.technical.close.toFixed(2)}</span>
            <span className={`block text-[10.5px] font-semibold ${p.technical.changePct >= 0 ? 'text-up-600' : 'text-down-600'}`}>
              {p.technical.changePct >= 0 ? '+' : ''}{p.technical.changePct}%
            </span>
          </div>
        </div>

        {/* Strategy Badge & Score */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5">
            <Badge
              tone={
                p.strategyTag === 'STRATEGY_A'
                  ? 'success'
                  : p.strategyTag === 'STRATEGY_B'
                  ? 'warning'
                  : 'violet'
              }
              size="sm"
            >
              {p.strategy.replace('_', ' ')}
            </Badge>
            <SetupInfoHover pick={p} />
          </div>
          <span className="text-xs font-extrabold text-up-700 bg-up-50 px-2 py-0.5 rounded border border-up-200">
            {p.winProbability}% Prob · R:R 1:{p.riskReward}
          </span>
        </div>

        {/* Trade Levels Grid */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-[#F8FAFF] p-2.5 text-center text-xs">
          <div>
            <span className="text-[10px] text-ink-400 font-semibold block">ENTRY</span>
            <span className="font-extrabold text-ink-900 tnum">₹{p.entry.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-down-600 font-semibold block">STOP LOSS</span>
            <span className="font-extrabold text-down-600 tnum">₹{p.stopLoss.toFixed(2)}</span>
            <span className="text-[9px] text-down-500 block">(-{p.stopLossPct}%)</span>
          </div>
          <div>
            <span className="text-[10px] text-up-600 font-semibold block">TARGET 1</span>
            <span className="font-extrabold text-up-700 tnum">₹{p.target1.toFixed(2)}</span>
            <span className="text-[9px] text-up-600 block">(+{p.target1Pct}%)</span>
          </div>
        </div>

        {/* Position Sizing Preview */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-ink-600 px-1">
          <span>Qty: <strong className="text-ink-900">{p.positionSizing.suggestedQty} shares</strong></span>
          <span>Outlay: <strong className="text-ink-900">₹{p.positionSizing.tradeValue.toLocaleString('en-IN')}</strong></span>
        </div>

        {/* 10-Day Horizon */}
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-ink-500 px-1">
          <span>Est. {p.expectedDaysToTarget} days to T1</span>
          <span className="font-bold text-ink-700">{p.tenDayTargetFeasibility}</span>
        </div>
      </div>

      {/* Button */}
      <div className="mt-3 pt-2.5 border-t border-[#DFE6F1]/70">
        <button
          type="button"
          onClick={onSelect}
          className="w-full rounded-xl bg-[#F0EBFF] py-1.5 text-xs font-bold text-[#7046E8] hover:bg-[#7046E8] hover:text-white transition-all text-center"
        >
          View 10-Day Plan &amp; Checklist
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   DEEP DIVE MODAL FOR DETAILED SETUP REVIEW
   ========================================================================= */
function PickDetailModal({
  pick,
  onClose,
}: {
  pick: SwingTradingPickDto
  onClose: () => void
}) {
  const p = pick

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#DFE6F1] bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="border-b border-[#DFE6F1] pb-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#F0EBFF] px-2.5 py-0.5 text-xs font-extrabold text-[#7046E8]">
              #{p.rank} SWING PICK
            </span>
            <Badge
              tone={
                p.strategyTag === 'STRATEGY_A'
                  ? 'success'
                  : p.strategyTag === 'STRATEGY_B'
                  ? 'warning'
                  : 'violet'
              }
              size="md"
            >
              {p.strategyName}
            </Badge>
            <SetupInfoHover pick={p} />
          </div>

          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-ink-950 tracking-tight flex items-center gap-2">
                {p.symbol}
                <span className="text-sm font-normal text-ink-500">({p.name || p.sector})</span>
              </h2>
              <p className="text-xs text-ink-500">Sector: <strong>{p.sector}</strong> · NSE CNC Delivery</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-ink-950 tnum">₹{p.technical.close.toFixed(2)}</span>
              <span className={`ml-2 text-xs font-bold ${p.technical.changePct >= 0 ? 'text-up-600' : 'text-down-600'}`}>
                {p.technical.changePct >= 0 ? '+' : ''}{p.technical.changePct}%
              </span>
            </div>
          </div>
        </div>

        {/* Modal Content Sections */}
        <div className="mt-5 space-y-6 text-xs">
          {/* Section 1: Execution Levels */}
          <div className="rounded-xl border border-[#DFE6F1] bg-[#F8FAFF] p-4">
            <h3 className="font-extrabold text-ink-900 text-sm mb-3">10-Day Swing Trade Plan</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg bg-white p-3 border border-[#DFE6F1]">
                <span className="text-[10.5px] font-semibold text-ink-500 block">ENTRY TRIGGER</span>
                <span className="text-sm font-extrabold text-ink-900 tnum">₹{p.entry.toFixed(2)}</span>
                <span className="text-[10px] text-ink-400 block">Signal High Breakout</span>
              </div>
              <div className="rounded-lg bg-white p-3 border border-down-200">
                <span className="text-[10.5px] font-semibold text-down-600 block">STOP LOSS</span>
                <span className="text-sm font-extrabold text-down-600 tnum">₹{p.stopLoss.toFixed(2)}</span>
                <span className="text-[10px] text-down-500 block">-{p.stopLossPct}% ({p.stopLossType})</span>
              </div>
              <div className="rounded-lg bg-white p-3 border border-up-200">
                <span className="text-[10.5px] font-semibold text-up-700 block">TARGET 1 (50% BOOK)</span>
                <span className="text-sm font-extrabold text-up-700 tnum">₹{p.target1.toFixed(2)}</span>
                <span className="text-[10px] text-up-600 block">+{p.target1Pct}% (R:R 1:{p.riskReward})</span>
              </div>
              <div className="rounded-lg bg-white p-3 border border-up-200">
                <span className="text-[10.5px] font-semibold text-up-700 block">TARGET 2 (RUNNER)</span>
                <span className="text-sm font-extrabold text-up-700 tnum">₹{p.target2.toFixed(2)}</span>
                <span className="text-[10px] text-up-600 block">+{p.target2Pct}% (10D Runner)</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-medium text-ink-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-[#DFE6F1]">
              <strong>Trigger Rule:</strong> {p.entryTrigger}
            </p>
          </div>

          {/* Section 2: Position Sizing Breakdown */}
          <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2">
            <h3 className="font-extrabold text-ink-900 text-sm flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-[#7046E8]" /> Position Sizing Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8FF] p-3 rounded-lg border border-[#E3D7FF] text-center">
              <div>
                <span className="text-[10.5px] text-ink-500 block">Suggested Shares</span>
                <span className="text-base font-extrabold text-[#7046E8] tnum">{p.positionSizing.suggestedQty}</span>
              </div>
              <div>
                <span className="text-[10.5px] text-ink-500 block">Capital Outlay</span>
                <span className="text-sm font-bold text-ink-900 tnum">₹{p.positionSizing.tradeValue.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-ink-500">({p.positionSizing.capitalAllocPct}% of capital)</span>
              </div>
              <div>
                <span className="text-[10.5px] text-down-600 block">Max Loss</span>
                <span className="text-sm font-bold text-down-600 tnum">-₹{p.positionSizing.maxLoss.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10.5px] text-up-700 block">Target 1 Profit</span>
                <span className="text-sm font-bold text-up-700 tnum">+₹{p.positionSizing.target1Profit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Section 3: 6-Point Combine Checklist */}
          <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2.5">
            <h3 className="font-extrabold text-ink-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-up-600" /> 6-Point Combine Checklist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>Market:</strong> Nifty trend verified (50 EMA rule)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>Sector:</strong> {p.sector} outperforming benchmark</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>Stock RS:</strong> Relative strength line rising vs Nifty 50</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>Setup:</strong> Clean {p.strategy.replace('_', ' ')} pattern detected</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>Risk:Reward:</strong> 1:{p.riskReward} meets minimum 1:2.0 rule</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFF] border border-[#DFE6F1]">
                <CheckCircle2 className="h-4 w-4 text-up-600 shrink-0" />
                <span><strong>10D Feasible:</strong> Reaches T1 in ~{p.expectedDaysToTarget} sessions (ATR velocity)</span>
              </div>
            </div>
          </div>

          {/* Section 4: Exit & Trailing Playbook */}
          <div className="rounded-xl border border-[#DFE6F1] bg-white p-4 space-y-2">
            <h3 className="font-extrabold text-ink-900 text-sm">Exit &amp; Trailing Rules (10-Day Fit)</h3>
            <ul className="space-y-1.5 text-[11.5px] text-ink-700 pl-2">
              {p.exitRules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#7046E8] font-bold">›</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 5: Technical Details Grid */}
          <div className="rounded-xl border border-[#DFE6F1] bg-[#F8FAFF] p-4 space-y-2">
            <h3 className="font-extrabold text-ink-900 text-sm">Technical Indicators Confluence</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
              <div className="rounded bg-white p-2 border border-[#DFE6F1]">
                <span className="text-ink-400 block">20 EMA / 50 EMA</span>
                <span className="font-bold text-ink-900">₹{p.technical.ema20.toFixed(1)} / ₹{p.technical.ema50.toFixed(1)}</span>
              </div>
              <div className="rounded bg-white p-2 border border-[#DFE6F1]">
                <span className="text-ink-400 block">ATR(14)</span>
                <span className="font-bold text-ink-900">₹{p.technical.atr14.toFixed(2)} ({p.technical.atrPct.toFixed(1)}%)</span>
              </div>
              <div className="rounded bg-white p-2 border border-[#DFE6F1]">
                <span className="text-ink-400 block">RSI / ADX</span>
                <span className="font-bold text-ink-900">{p.technical.rsi14.toFixed(0)} / {p.technical.adx14.toFixed(0)}</span>
              </div>
              <div className="rounded bg-white p-2 border border-[#DFE6F1]">
                <span className="text-ink-400 block">Relative Volume</span>
                <span className="font-bold text-ink-900">{p.technical.relVol.toFixed(1)}× 20D Avg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Links */}
        <div className="mt-6 pt-4 border-t border-[#DFE6F1] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to={`/stocks/${p.symbol}`}
              className="inline-flex items-center gap-1 rounded-xl border border-[#DFE6F1] bg-white px-3.5 py-1.5 text-xs font-bold text-ink-700 hover:bg-[#F0EBFF] hover:text-[#7046E8] transition-colors"
            >
              Interactive Charts <ArrowUpRight size={14} />
            </Link>
            <Link
              to={`/analyst/${p.symbol}`}
              className="inline-flex items-center gap-1 rounded-xl border border-[#DFE6F1] bg-white px-3.5 py-1.5 text-xs font-bold text-ink-700 hover:bg-[#F0EBFF] hover:text-[#7046E8] transition-colors"
            >
              Ask AI Analyst <ArrowUpRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#7046E8] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#5B33CC] transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   SETUP INFO HOVER COMPONENT (POPUP ON HOVER)
   Shows: 1) What this strategy is based on, 2) Why this stock qualified,
   3) 10-day target logic and execution criteria.
   ========================================================================= */
const STRATEGY_CONCEPT_MAP: Record<string, { title: string; concept: string; whyWorks: string }> = {
  EMA_PULLBACK: {
    title: 'Strategy A: EMA Pullback (Trend Continuation)',
    concept: 'Dip-buy in confirmed Stage-2 uptrend near rising 20-EMA.',
    whyWorks:
      'In strong trending stocks, pullbacks into the 20-EMA with dry/declining volume represent institutional dip absorption. Once price prints a bullish bounce candle, buyers take out the high, leading to a fast 5–10 day trend resumption.',
  },
  VOLUME_BREAKOUT: {
    title: 'Strategy B: Volume Breakout + Relative Strength',
    concept: 'Institutional breakout from a 3–8 week tight base on 1.5–2× volume.',
    whyWorks:
      'Stocks consolidating within a tight 10–15% base near 52-week highs store enormous coiled energy. Breakouts supported by heavy institutional volume produce the fastest sprint momentum moves during the first 5–10 trading days.',
  },
  MINERVINI_VCP: {
    title: 'Strategy #10: Minervini Volatility Contraction Pattern (VCP)',
    concept: 'Successive volatility contractions with volume dry-up.',
    whyWorks:
      'Mark Minervini’s hallmark pattern: each contraction is shallower than the previous one (e.g. 20% → 10% → 4%) as sellers are absorbed. The final pivot breakout on expanding volume offers high win rates with minimal stop-loss risk.',
  },
  NR7_INSIDE_BAR: {
    title: 'Strategy #9: Inside Bar / NR7 Range Contraction',
    concept: 'Narrowest Daily Range of 7 sessions / Inside Bar in established trend.',
    whyWorks:
      'Toby Crabel principle: periods of extreme range compression are inevitably followed by explosive range expansion. Provides an asymmetric risk-reward trade with a very tight stop loss below the NR7 low.',
  },
  SUPERTREND_RIDER: {
    title: 'Strategy #3: Supertrend (10,3) Trend Rider',
    concept: 'Trend-following continuation ride supported by ADX > 22.',
    whyWorks:
      'Captures persistent directional trend moves. The green Supertrend line acts as dynamic trailing support while ADX confirming directional conviction protects against whipsaws.',
  },
  DELIVERY_SURGE: {
    title: 'Strategy #23: Delivery % Surge Accumulation',
    concept: 'Institutional smart-money delivery accumulation footprint.',
    whyWorks:
      'Spikes in delivery percentage over 10-day averages accompanying rising price and volume reveal genuine institutional accumulation for delivery (CNC) rather than intraday noise.',
  },
}

export function SetupInfoHover({ pick }: { pick: SwingTradingPickDto }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null)
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const info = STRATEGY_CONCEPT_MAP[pick.strategy] || {
    title: pick.strategyName,
    concept: 'High-confluence 10-day swing trading setup.',
    whyWorks: 'Verified quantitative setup combining trend, momentum, volume, and risk:reward.',
  }

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = 350
    const popoverHeight = 360

    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight

    let left = rect.left + rect.width / 2 - popoverWidth / 2
    if (left < 16) left = 16
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16
    }

    setCoords({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left,
      placeAbove,
    })
  }

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    updatePosition()
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 180)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation()
          updatePosition()
          setIsOpen(!isOpen)
        }}
        className="group/info inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#F0EBFF] text-[#7046E8] hover:bg-[#7046E8] hover:text-white cursor-pointer transition-all shadow-2xs shrink-0"
        title="Why this setup was picked (Hover to view explanation)"
      >
        <Info size={11} strokeWidth={2.5} className="transition-transform group-hover/info:scale-110" />
      </span>

      {isOpen &&
        coords &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, scale: 0.95, y: coords.placeAbove ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onMouseEnter={() => {
                if (timerRef.current) clearTimeout(timerRef.current)
              }}
              onMouseLeave={handleMouseLeave}
              style={{
                position: 'fixed',
                top: coords.placeAbove ? 'auto' : coords.top,
                bottom: coords.placeAbove ? window.innerHeight - coords.top : 'auto',
                left: coords.left,
                zIndex: 99999,
                width: '350px',
              }}
              className="rounded-2xl border border-[#CFBAFF] bg-white/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 text-xs text-ink-800 focus:outline-hidden"
            >
              {/* Popover Header */}
              <div className="flex items-start justify-between border-b border-[#DFE6F1] pb-2.5">
                <div>
                  <span className="rounded bg-[#F0EBFF] px-2 py-0.5 text-[9.5px] font-extrabold text-[#7046E8] uppercase tracking-wider">
                    SETUP EXPLANATION
                  </span>
                  <h4 className="mt-1 text-sm font-extrabold text-ink-950 leading-snug">{info.title}</h4>
                  <p className="text-[11px] text-ink-500">{info.concept}</p>
                </div>
                <span className="rounded-full bg-up-50 text-up-700 px-2 py-0.5 text-[10.5px] font-extrabold border border-up-200 shrink-0">
                  {pick.winProbability}% Edge
                </span>
              </div>

              {/* Core Strategy Concept */}
              <div className="mt-3 rounded-xl bg-[#F8FAFF] p-2.5 border border-[#DFE6F1]">
                <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Why This Strategy Works</p>
                <p className="mt-1 text-[11px] text-ink-700 leading-relaxed">{info.whyWorks}</p>
              </div>

              {/* Why THIS Stock Qualified (Exact Signals) */}
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#7046E8]" /> Why {pick.symbol} Qualified
                </p>
                <ul className="space-y-1 text-[11px] text-ink-700">
                  {pick.reasons.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-up-600 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Technical Indicator Snapshot */}
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#FAF8FF] p-2 border border-[#E3D7FF] text-center text-[10.5px]">
                <div>
                  <span className="text-ink-400 block text-[9.5px]">REL. VOL</span>
                  <strong className="text-ink-900">{pick.technical.relVol.toFixed(1)}×</strong>
                </div>
                <div>
                  <span className="text-ink-400 block text-[9.5px]">RS VS NIFTY</span>
                  <strong className={pick.technical.rsVsNifty60d >= 0 ? 'text-up-600' : 'text-down-600'}>
                    {pick.technical.rsVsNifty60d >= 0 ? '+' : ''}{pick.technical.rsVsNifty60d.toFixed(1)}%
                  </strong>
                </div>
                <div>
                  <span className="text-ink-400 block text-[9.5px]">RISK : REWARD</span>
                  <strong className="text-up-700">1:{pick.riskReward}</strong>
                </div>
              </div>

              {/* Targets & Time Horizon */}
              <div className="mt-3 pt-2.5 border-t border-[#DFE6F1] flex items-center justify-between text-[10.5px]">
                <span className="text-ink-500">
                  Target 1: <strong className="text-up-700">₹{pick.target1.toFixed(2)}</strong> (+{pick.target1Pct}%)
                </span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Est. {pick.expectedDaysToTarget}d to target
                </span>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
