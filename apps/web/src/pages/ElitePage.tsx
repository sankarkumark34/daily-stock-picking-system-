import type { MarketOverviewDto, PickDto } from '@nse/shared'
import { FACTOR_LABELS } from '@nse/shared'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Star,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge, Card, EmptyState, FactorBar, Skeleton, fadeUp, staggerList } from '../components/ui'
import { useMarketOverview, usePicks } from '../lib/api'
import { dateLong, fmt, inr, regimeLabel, regimeTone, setupLabel, setupTone } from '../lib/format'

/* ─────────────────────────────────────────────────────────────────────── */
/* Playbook §9.6 Correlation Matrix:                                       */
/* Pick 1 best stock per sector → top 4 different sectors                  */
/* ─────────────────────────────────────────────────────────────────────── */
function pickElitePortfolio(picks: PickDto[]): PickDto[] {
  const qualified = picks
    .filter((p) => p.outcome === 'OPEN' && !p.isBacktest && p.score >= 65 && p.riskReward >= 2.0)
    .sort((a, b) => b.score - a.score || b.riskReward - a.riskReward)

  // One best pick per sector
  const bySector = new Map<string, PickDto>()
  for (const pick of qualified) {
    if (!bySector.has(pick.sector)) bySector.set(pick.sector, pick)
  }

  // Top 4 sectors by their best score
  const diversified = [...bySector.values()].sort((a, b) => b.score - a.score).slice(0, 4)

  // If < 4, fill with next-best (different symbol) from remaining qualified
  if (diversified.length < 4) {
    const usedIds = new Set(diversified.map((p) => p.id))
    const extras = qualified.filter((p) => !usedIds.has(p.id)).slice(0, 4 - diversified.length)
    diversified.push(...extras)
  }

  // Fallback: relax criteria, just take top 4 open picks
  if (diversified.length === 0) {
    return picks.filter((p) => p.outcome === 'OPEN' && !p.isBacktest).sort((a, b) => b.score - a.score).slice(0, 4)
  }

  return diversified
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Playbook §9.2 Position Sizing Formula                                   */
/* ─────────────────────────────────────────────────────────────────────── */
function calcSizing(capital: number, riskPct: number, entry: number, stopLoss: number) {
  const riskAmount = (capital * riskPct) / 100
  const riskPerShare = Math.max(0.01, entry - stopLoss)
  const riskBasedQty = Math.floor(riskAmount / riskPerShare)
  const maxPositionValue = capital * 0.25
  const maxQty = Math.floor(maxPositionValue / entry)
  const finalQty = Math.min(riskBasedQty, maxQty)
  const positionValue = finalQty * entry
  const actualRisk = finalQty * riskPerShare
  const actualRiskPct = capital > 0 ? (actualRisk / capital) * 100 : 0
  return { riskAmount, riskPerShare, riskBasedQty, maxQty, finalQty, positionValue, actualRisk, actualRiskPct }
}

/* Quick 5-check checklist per pick */
type QuickCheck = { label: string; pass: boolean }
function evalQuickChecklist(pick: PickDto, overview: MarketOverviewDto | undefined): QuickCheck[] {
  const sectorRank = overview?.sectors.find((s) => s.sector === pick.sector)?.rank ?? null
  const volumeFactor = pick.factors.find((f) => f.name === 'volume')
  const trendFactor = pick.factors.find((f) => f.name === 'trend')
  return [
    { label: 'Market aligned', pass: overview ? ['BULLISH', 'STRONG_BULLISH'].includes(overview.regime) : false },
    { label: 'Sector top 5', pass: sectorRank !== null ? sectorRank <= 5 : false },
    { label: 'Volume ≥ 60', pass: volumeFactor ? volumeFactor.raw >= 60 : false },
    { label: 'Trend intact', pass: trendFactor ? trendFactor.raw >= 55 : false },
    { label: 'R:R ≥ 2.0', pass: pick.riskReward >= 2.0 },
  ]
}

/* Rank visual config */
const RANK_CONFIG = [
  {
    medal: '🥇',
    label: '1st',
    headerGrad: 'from-amber-500/10 via-amber-400/5 to-transparent',
    ringColor: '#d97706',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800 ring-amber-300',
  },
  {
    medal: '🥈',
    label: '2nd',
    headerGrad: 'from-indigo-500/10 via-blue-400/5 to-transparent',
    ringColor: '#6366f1',
    border: 'border-indigo-200',
    badgeBg: 'bg-indigo-100 text-indigo-800 ring-indigo-300',
  },
  {
    medal: '🥉',
    label: '3rd',
    headerGrad: 'from-emerald-500/10 via-teal-400/5 to-transparent',
    ringColor: '#059669',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  },
  {
    medal: '⭐',
    label: '4th',
    headerGrad: 'from-violet-500/10 via-purple-400/5 to-transparent',
    ringColor: '#7c3aed',
    border: 'border-violet-200',
    badgeBg: 'bg-violet-100 text-violet-800 ring-violet-300',
  },
]

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Main Page                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */
export function ElitePage() {
  const { data: picksData, isLoading: picksLoading } = usePicks()
  const { data: overview } = useMarketOverview()
  const [capital, setCapital] = useState(80000)
  const [riskPct, setRiskPct] = useState(1.5)

  if (picksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  const allPicks = picksData?.picks ?? []
  const portfolio = pickElitePortfolio(allPicks)
  const totalPortfolioRisk = portfolio.reduce((sum, p) => {
    const s = calcSizing(capital, riskPct, p.entry, p.stopLoss)
    return sum + s.actualRiskPct
  }, 0)

  if (!portfolio.length) {
    return (
      <div>
        <PageHeader overview={overview} date={picksData?.date} />
        <EmptyState
          title="No Elite picks today"
          body="No open pick cleared the minimum quality bar (score ≥ 65, R:R ≥ 2.0). Either the pipeline has not run yet, or market conditions make no setup qualify."
          action={
            <Link to="/picks">
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                View All Picks <ArrowRight size={14} />
              </button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-5">
      {/* Page Header */}
      <PageHeader overview={overview} date={picksData?.date} />

      {/* Diversification Banner */}
      <motion.div variants={fadeUp}>
        <DiversificationBanner picks={portfolio} totalRiskPct={totalPortfolioRisk} />
      </motion.div>

      {/* Market Context Strip */}
      {overview && (
        <motion.div variants={fadeUp}>
          <MarketContextStrip overview={overview} />
        </motion.div>
      )}

      {/* 4 Stock Cards — 2×2 Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {portfolio.map((pick, i) => (
          <motion.div key={pick.id} variants={fadeUp}>
            <EliteStockCard
              pick={pick}
              rank={i + 1}
              overview={overview}
              capital={capital}
              riskPct={riskPct}
            />
          </motion.div>
        ))}
      </div>

      {/* Portfolio Position Sizer */}
      <motion.div variants={fadeUp}>
        <PortfolioSizer
          picks={portfolio}
          capital={capital}
          riskPct={riskPct}
          onCapitalChange={setCapital}
          onRiskChange={setRiskPct}
        />
      </motion.div>

      {/* Playbook Rules Reminder */}
      <motion.div variants={fadeUp}>
        <PlaybookReminderBar totalRiskPct={totalPortfolioRisk} pickCount={portfolio.length} />
      </motion.div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                          */
/* ─────────────────────────────────────────────────────────────────────── */

function PageHeader({ overview, date }: { overview: MarketOverviewDto | undefined; date: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink-900">
          <Star size={20} className="fill-amber-400 text-amber-400" />
          Elite 4 — Diversified Swing Portfolio
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {date
            ? `Top pick from 4 different sectors after close on ${dateLong(date)} — correlation-protected (Playbook §9.6).`
            : `Top pick from 4 different sectors · One sector drops, others stay — Playbook §9.6 correlation matrix.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {overview && (
          <Badge tone={regimeTone(overview.regime)} size="md">
            {regimeLabel(overview.regime)}
          </Badge>
        )}
        <Link to="/picks" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
          All picks <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

/* ── Diversification Banner ── */
function DiversificationBanner({ picks, totalRiskPct }: { picks: PickDto[]; totalRiskPct: number }) {
  const sectors = picks.map((p) => p.sector)
  const allUnique = new Set(sectors).size === sectors.length

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-900">
              {allUnique ? '✅ 4 Different Sectors — Zero Correlation Risk' : '⚠️ Some sectors overlap — check correlation'}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Playbook §9.6: &quot;Avoid multiple stocks from same sector.&quot; If one sector drops, your other 3 positions are protected.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {picks.map((p, i) => {
            const cfg = RANK_CONFIG[i] ?? RANK_CONFIG[3]
            return (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-900">
                {cfg.medal} <span className="font-bold">{p.symbol}</span>
                <span className="text-emerald-600">·</span>
                <span className="text-emerald-700">{p.sector}</span>
              </span>
            )
          })}
        </div>
      </div>
      {totalRiskPct > 6 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={13} className="shrink-0 text-amber-600" />
          Total portfolio heat {fmt(totalRiskPct, 1)}% exceeds §9.4 limit (4–6%). Reduce risk % per trade or reduce position count.
        </div>
      )}
    </div>
  )
}

/* ── Market Context Strip (compact) ── */
function MarketContextStrip({ overview }: { overview: MarketOverviewDto }) {
  const vix = overview.vix
  const topSector = overview.sectors[0]
  const vixLabel = vix ? (vix.close < 15 ? '✅ Low' : vix.close < 20 ? '🟡 Normal' : '🔴 High') : '—'
  const adRatio = overview.breadth.advanceDeclineRatio

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ContextChip label="Market Regime" value={regimeLabel(overview.regime)} tone={regimeTone(overview.regime)} />
      <ContextChip label="India VIX" value={vix ? `${fmt(vix.close, 1)} — ${vixLabel}` : '—'} tone={vix && vix.close > 20 ? 'danger' : 'neutral'} />
      <ContextChip label="Breadth (A/D)" value={`${overview.breadth.advances}/${overview.breadth.declines} · ${fmt(adRatio, 2)}`} tone={adRatio >= 1 ? 'success' : 'danger'} />
      {topSector && <ContextChip label="Leading Sector" value={`#1 ${topSector.sector}`} tone="success" />}
    </div>
  )
}

function ContextChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  const bg =
    tone === 'success'
      ? 'bg-up-50 border-up-100'
      : tone === 'danger'
        ? 'bg-down-50 border-down-100'
        : 'bg-ink-50 border-ink-200'
  const text =
    tone === 'success' ? 'text-up-700' : tone === 'danger' ? 'text-down-700' : 'text-ink-700'
  return (
    <div className={clsx('rounded-xl border p-3', bg)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={clsx('mt-0.5 text-xs font-bold tnum', text)}>{value}</p>
    </div>
  )
}

/* ── Elite Stock Card ── */
function EliteStockCard({
  pick,
  rank,
  overview,
  capital,
  riskPct,
}: {
  pick: PickDto
  rank: number
  overview: MarketOverviewDto | undefined
  capital: number
  riskPct: number
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RANK_CONFIG[rank - 1] ?? RANK_CONFIG[3]
  const sizing = calcSizing(capital, riskPct, pick.entry, pick.stopLoss)
  const checks = evalQuickChecklist(pick, overview)
  const passCount = checks.filter((c) => c.pass).length
  const isSprint = pick.holdDays <= 14
  const targetProfit = sizing.finalQty * (pick.target - pick.entry)
  const breakevenPrice = pick.breakevenTrigger ?? Math.round(pick.entry * 1.07 * 100) / 100

  return (
    <div className={clsx('overflow-hidden rounded-2xl border bg-white/70 backdrop-blur-md shadow-xs transition-all duration-300 hover:shadow-md', cfg.border)}>
      {/* Light gradient header */}
      <div className={clsx('relative border-b border-ink-100 bg-gradient-to-br p-4 text-ink-900', cfg.headerGrad)}>
        {/* Decorative blob */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/5 blur-2xl" />

        <div className="flex items-start justify-between gap-3">
          {/* Left: rank + badges + symbol */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={clsx('rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', cfg.badgeBg)}>
                {cfg.medal} #{rank} {cfg.label}
              </span>
              <Badge tone={setupTone(pick.setup)}>{setupLabel(pick.setup)}</Badge>
              {isSprint ? (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-700 ring-1 ring-ink-200">⚡ {pick.holdDays}d</span>
              ) : (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-700 ring-1 ring-ink-200">🎯 {pick.holdDays}d</span>
              )}
            </div>
            <p className="text-3xl font-black tracking-tight text-ink-900 truncate">{pick.symbol}</p>
            <p className="text-xs text-ink-500 truncate mt-0.5">{pick.name ?? pick.sector}</p>
            <div className="mt-2">
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-700 ring-1 ring-ink-200">
                {pick.sector}
              </span>
            </div>
          </div>

          {/* Right: Score ring */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <MiniScoreRing score={pick.score} color={cfg.ringColor} />
            <p className="text-[10px] text-ink-500 font-semibold uppercase tracking-wide">Score</p>
            <p className="text-xs text-ink-600">Conf. {pick.confidence}%</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MiniStat label="Entry" value={inr(pick.entry)} />
          <MiniStat label="Target" value={inr(pick.target)} sub={`+${fmt(pick.rewardPct, 1)}%`} tone="up" />
          <MiniStat label="Stop" value={inr(pick.stopLoss)} sub={`-${fmt(pick.riskPct, 1)}%`} tone="down" />
          <MiniStat label="R:R" value={`${fmt(pick.riskReward, 2)}:1`} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Quick checklist dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {checks.map((c, i) => (
              <span key={i} title={c.label}>
                {c.pass ? (
                  <CheckCircle2 size={14} className="text-up-600" />
                ) : (
                  <XCircle size={14} className="text-down-500" />
                )}
              </span>
            ))}
            <span className="ml-1 text-[11px] font-semibold text-ink-500">{passCount}/5 checks</span>
          </div>
          <Link
            to={`/stocks/${pick.symbol}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Chart <ExternalLink size={11} />
          </Link>
        </div>

        {/* Quick check labels (hover) — visible on small screens */}
        <div className="flex flex-wrap gap-1">
          {checks.map((c, i) => (
            <span
              key={i}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                c.pass ? 'bg-up-50 text-up-700' : 'bg-down-50 text-down-700',
              )}
            >
              {c.pass ? '✓' : '✗'} {c.label}
            </span>
          ))}
        </div>

        {/* Sizing quick view */}
        {sizing.finalQty > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 font-semibold">
                {sizing.finalQty} shares @ {inr(sizing.positionValue, 0)}
              </span>
              <span className="text-up-700 font-bold">+{inr(targetProfit, 0)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 mt-0.5">
              <span>Risk: −{inr(sizing.actualRisk, 0)} ({fmt(sizing.actualRiskPct, 1)}%)</span>
              <span>Breakeven at {inr(breakevenPrice)}</span>
            </div>
          </div>
        )}

        {/* Reasons */}
        {pick.reasons.length > 0 && (
          <ul className="space-y-1">
            {pick.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50/60 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 transition-colors"
        >
          <BarChart3 size={13} />
          Factor breakdown
          <ChevronDown size={13} className={clsx('transition-transform', expanded && 'rotate-180')} />
        </button>

        {/* Expandable factor breakdown */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 pt-1 border-t border-ink-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Factor Scores</p>
                {pick.factors.map((f) => (
                  <FactorBar key={f.name} label={FACTOR_LABELS[f.name]} raw={f.raw} weight={f.weight} note={f.note} tip={f.name} />
                ))}
                {/* Trade details */}
                <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/60 p-2.5 text-[11px] text-violet-900">
                  <p className="font-semibold flex items-center gap-1"><span>🛡️</span> Breakeven Shield</p>
                  <p className="mt-0.5">At {inr(breakevenPrice)} (+7%), move SL to entry {inr(pick.entry)}. Risk = ₹0.</p>
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-2.5 text-[11px] text-sky-900">
                  <p className="font-semibold">📋 Partial Booking</p>
                  <p className="mt-0.5">Book 50% at T1 ({inr(pick.target)}). Let rest run with trailing SL.</p>
                  {pick.target2 && <p>Runner T2: {inr(pick.target2)}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MiniScoreRing({ score, color }: { score: number; color: string }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="text-xl font-black text-ink-900 tnum">{Math.round(score)}</span>
    </div>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-lg bg-white/90 p-2 shadow-2xs ring-1 ring-ink-100 backdrop-blur-sm">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={clsx('text-sm font-bold tnum', tone === 'up' ? 'text-up-700' : tone === 'down' ? 'text-down-700' : 'text-ink-900')}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-ink-500 tnum">{sub}</p>}
    </div>
  )
}

/* ── Portfolio Position Sizer ── */
function PortfolioSizer({
  picks,
  capital,
  riskPct,
  onCapitalChange,
  onRiskChange,
}: {
  picks: PickDto[]
  capital: number
  riskPct: number
  onCapitalChange: (v: number) => void
  onRiskChange: (v: number) => void
}) {
  type Row = {
    pick: PickDto
    sizing: ReturnType<typeof calcSizing>
    targetProfit: number
    stopRisk: number
  }

  const rows: Row[] = picks.map((p) => {
    const sizing = calcSizing(capital, riskPct, p.entry, p.stopLoss)
    return {
      pick: p,
      sizing,
      targetProfit: sizing.finalQty * (p.target - p.entry),
      stopRisk: sizing.finalQty * (p.entry - p.stopLoss),
    }
  })

  const totalInvested = rows.reduce((s, r) => s + r.sizing.positionValue, 0)
  const totalGain = rows.reduce((s, r) => s + r.targetProfit, 0)
  const totalRisk = rows.reduce((s, r) => s + r.stopRisk, 0)
  const totalRiskPct = capital > 0 ? (totalRisk / capital) * 100 : 0
  const capitalPresets = [50000, 80000, 100000, 200000, 500000]

  return (
    <Card
      title={<span className="flex items-center gap-2"><Zap size={15} className="text-emerald-600" /> Portfolio Position Sizer</span>}
      subtitle="Playbook §9.2 formula — 1 best stock per sector, correlation-protected"
    >
      {/* Controls */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Total Capital</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 font-bold text-emerald-700">₹</span>
            <input
              type="number" step="5000" min="5000" value={capital}
              onChange={(e) => onCapitalChange(Math.max(5000, Number(e.target.value) || 5000))}
              className="w-full rounded-lg border border-emerald-300 bg-emerald-50/40 py-2 pl-7 pr-3 font-bold text-ink-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {capitalPresets.map((v) => (
              <button key={v} type="button" onClick={() => onCapitalChange(v)}
                className={clsx('rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors', capital === v ? 'bg-emerald-700 text-white' : 'bg-ink-100 text-ink-700 hover:bg-emerald-100')}>
                {v >= 100000 ? `₹${v / 100000}L` : `₹${v / 1000}k`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Risk per Trade</label>
            <span className="text-sm font-bold text-brand-700">{riskPct}%</span>
          </div>
          <input type="range" min={0.5} max={3} step={0.5} value={riskPct}
            onChange={(e) => onRiskChange(Number(e.target.value))}
            className="w-full accent-brand-600" />
          <div className="flex justify-between text-[10px] text-ink-400 mt-0.5">
            <span>0.5% Safe</span>
            <span>1.5% Balanced</span>
            <span>3% Aggressive</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            §9.4: With 4 positions, keep risk ≤ 1.5% each → total ≤ 6% portfolio heat
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-ink-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-ink-50 border-b border-ink-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-500">Stock</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-500">Sector</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">Entry</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">Qty</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">Invested</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">Target Gain</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">Max Risk</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-500">R:R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const cfg = RANK_CONFIG[i] ?? RANK_CONFIG[3]
              return (
                <tr key={row.pick.id} className="border-b border-ink-100 hover:bg-brand-50/30 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span>{cfg.medal}</span>
                      <span className="font-bold text-ink-900">{row.pick.symbol}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-500">{row.pick.sector}</td>
                  <td className="px-3 py-3 text-right tnum font-medium">{inr(row.pick.entry)}</td>
                  <td className="px-3 py-3 text-right tnum font-bold text-ink-900">{row.sizing.finalQty}</td>
                  <td className="px-3 py-3 text-right tnum text-ink-700">{inr(row.sizing.positionValue, 0)}</td>
                  <td className="px-3 py-3 text-right tnum font-semibold text-up-700">
                    {row.sizing.finalQty > 0 ? `+${inr(row.targetProfit, 0)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right tnum font-semibold text-down-700">
                    {row.sizing.finalQty > 0 ? `−${inr(row.stopRisk, 0)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right tnum font-medium">{fmt(row.pick.riskReward, 2)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-ink-50 border-t-2 border-ink-200">
              <td colSpan={4} className="px-3 py-3 text-xs font-bold text-ink-700">Portfolio Total</td>
              <td className="px-3 py-3 text-right tnum font-bold text-ink-900">{inr(totalInvested, 0)}</td>
              <td className="px-3 py-3 text-right tnum font-bold text-up-700">+{inr(totalGain, 0)}</td>
              <td className={clsx('px-3 py-3 text-right tnum font-bold', totalRiskPct > 6 ? 'text-down-700' : 'text-down-600')}>
                −{inr(totalRisk, 0)}
              </td>
              <td className="px-3 py-3 text-right tnum text-ink-500 text-[11px]">
                {totalRiskPct > 0 ? `${fmt(totalRiskPct, 1)}% heat` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Total Deployed</p>
          <p className="mt-1 text-base font-bold text-ink-900 tnum">{inr(totalInvested, 0)}</p>
          <p className="text-[10px] text-ink-500">{capital > 0 ? `${((totalInvested / capital) * 100).toFixed(0)}% of capital` : ''}</p>
        </div>
        <div className="rounded-lg border border-up-100 bg-up-50/60 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Potential Gain</p>
          <p className="mt-1 text-base font-bold text-up-700 tnum">+{inr(totalGain, 0)}</p>
          <p className="text-[10px] text-ink-500">{totalInvested > 0 ? `+${((totalGain / totalInvested) * 100).toFixed(1)}% on deployed` : ''}</p>
        </div>
        <div className={clsx('rounded-lg border p-3 text-center', totalRiskPct > 6 ? 'border-down-100 bg-down-50/60' : 'border-ink-100 bg-ink-50/60')}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Total Risk</p>
          <p className={clsx('mt-1 text-base font-bold tnum', totalRiskPct > 6 ? 'text-down-700' : 'text-ink-900')}>
            −{inr(totalRisk, 0)}
          </p>
          <p className="text-[10px] text-ink-500">{fmt(totalRiskPct, 1)}% portfolio heat</p>
        </div>
      </div>
    </Card>
  )
}

/* ── Playbook Rules Reminder bar ── */
function PlaybookReminderBar({ totalRiskPct, pickCount }: { totalRiskPct: number; pickCount: number }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
      <p className="text-xs font-bold text-ink-700 mb-3 flex items-center gap-1.5">
        📚 Playbook Rules Reminder (before you execute)
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[11px] text-ink-600">
        <RuleChip
          ok={totalRiskPct <= 6}
          text={`§9.4 Portfolio heat: ${fmt(totalRiskPct, 1)}% / 6% max`}
        />
        <RuleChip
          ok={pickCount <= 4}
          text={`§9.3 Position count: ${pickCount} / 4 max (beginner)`}
        />
        <RuleChip ok={true} text="§8 Wait for entry trigger before execution" />
        <RuleChip ok={true} text="§9.5 Set stop-loss immediately at entry — no hope-holding" />
        <RuleChip ok={true} text="§10.2 Book 50% at T1, trail rest with 20 EMA" />
        <RuleChip ok={true} text="§10.4 Time stop: 5+ days no move → exit" />
        <RuleChip ok={true} text="§10.7 Gap down below SL at open → exit immediately" />
        <RuleChip ok={true} text="§17.4 Manually verify event risk (results/RBI/expiry)" />
      </div>
    </div>
  )
}

function RuleChip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={clsx('flex items-start gap-1.5 rounded-lg px-2.5 py-2', ok ? 'bg-up-50/60 text-up-900' : 'bg-down-50/60 text-down-900')}>
      {ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-up-600" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0 text-down-600" />}
      <span>{text}</span>
    </div>
  )
}
