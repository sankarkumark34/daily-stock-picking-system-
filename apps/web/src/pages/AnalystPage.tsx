import type { AnalystVerdict, CheckStatus, ChecklistItem, NewsItem, StockAnalysisDto } from '@nse/shared'
import clsx from 'clsx'
import { ExternalLink, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge, Button, Callout, Card, InfoTip, PageHeader, ProgressBar, Skeleton, StatTile, Term, fadeUp, staggerList } from '../components/ui'
import { useAiNote, useAskAnalyst, useStockAnalysis } from '../lib/api'
import { StockSearch, rememberSymbol } from '../components/StockSearch'
import { dateLong, fmt, inr, pct, regimeLabel, regimeTone, setupLabel, setupTone, timeAgo, type Tone } from '../lib/format'
import { PicksTable } from './PicksPage'

const verdictTone = (v: AnalystVerdict): Tone => (v === 'BUY' ? 'success' : v === 'WATCH' ? 'warning' : 'danger')
const verdictLabel = (v: AnalystVerdict) => (v === 'BUY' ? 'Buy / Long' : v === 'WATCH' ? 'Watch' : 'Avoid')
const statusTone = (s: CheckStatus): Tone => (s === 'PASS' ? 'success' : s === 'WARN' ? 'warning' : s === 'FAIL' ? 'danger' : 'neutral')
const CHECK_TIPS: Record<string, string> = {
  'above-200': 'sma200', 'ema-stack': 'ema', adx: 'adx', 'rs-nifty': 'relativeStrength', rsi: 'rsi', macd: 'macd', ret60: 'roc',
  relvol: 'relVol', obv: 'obv', delivery: 'delivery', atr: 'atr', 'near-high': 'dist52w', 'higher-lows': 'higherLows', 'not-extended': 'ext21',
  sector: 'sectorStrength', regime: 'marketRegime', liquidity: 'turnover', setup: 'setup', rr: 'riskReward', drawdown: 'maxDrawdown',
}
const signCls = (v: number | null | undefined) => (v === null || v === undefined ? 'text-ink-400' : v > 0 ? 'text-up-700' : v < 0 ? 'text-down-700' : 'text-ink-700')

export function AnalystPage() {
  const { symbol } = useParams()
  const { data, isLoading, error } = useStockAnalysis(symbol)
  useEffect(() => {
    if (symbol) rememberSymbol(symbol.toUpperCase())
  }, [symbol])

  return (
    <>
      <PageHeader
        title="Stock Analyst"
        description="Search any NSE stock. The analyst runs a full checklist on its history, shows how it behaves under market stress, what similar setups did before, recent company and macro news, and (with Claude credentials) an AI note on news and geopolitical impact."
        actions={symbol ? <StockSearch className="sm:w-96" placeholder={`Analysing ${symbol} — search another…`} /> : undefined}
      />
      {!symbol && (
        <div className="mx-auto max-w-2xl py-10">
          <StockSearch size="lg" autoFocus />
          <p className="mt-3 text-center text-sm text-ink-500">Start typing a symbol or any word of the company name — suggestions appear as you type. Recently analysed stocks and today’s picks show up before you type.</p>
        </div>
      )}
      {symbol && error && <Callout tone="danger">{(error as Error).message}</Callout>}
      {symbol && isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-96 md:col-span-4" />
        </div>
      )}
      {data && <Analysis a={data} />}
    </>
  )
}

function Analysis({ a }: { a: StockAnalysisDto }) {
  const groups = [...new Set(a.checklist.map((c) => c.group))]
  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-card">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{a.symbol}</h2>
            <Badge tone="neutral">{a.sector}</Badge>
            {a.setup !== 'NONE' && <Badge tone={setupTone(a.setup)}>{setupLabel(a.setup)} setup</Badge>}
            {a.regime && <Badge tone={regimeTone(a.regime)}>{regimeLabel(a.regime)} market</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {a.name ?? '—'} · as of {dateLong(a.asOf)}
            {a.sectorRank !== null && ` · sector rank #${a.sectorRank}`}
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tnum">{inr(a.price)}</span>
            <span className={clsx('text-sm tnum', signCls(a.changePct))}>{pct(a.changePct, 2, true)} today</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Badge tone={verdictTone(a.verdict)} size="md" className="px-3 py-1.5 text-sm font-semibold">
              {verdictLabel(a.verdict)}
            </Badge>
            <InfoTip term="verdict" />
          </span>
          <div className="w-56">
            <div className="mb-1 flex justify-between text-[11px] text-ink-500">
              <Term k="checklistScore">Checklist score</Term>
              <span className="tnum font-medium text-ink-900">{a.score}/100</span>
            </div>
            <ProgressBar value={a.score} tone={verdictTone(a.verdict)} />
            <p className="mt-1 text-[11px] text-ink-500">
              {a.checklistSummary.pass} pass · {a.checklistSummary.warn} warn · {a.checklistSummary.fail} fail
              {a.checklistSummary.na ? ` · ${a.checklistSummary.na} n/a` : ''}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Liquidity floors */}
      <Card
        title={<Term k="turnover">Traded value (purchase value) filter</Term>}
        subtitle="Minimum turnover the daily model demands before a stock can be picked"
        action={<Badge tone={a.liquidity.pass ? 'success' : 'danger'} size="md">{a.liquidity.pass ? 'Passes all 3 floors' : 'Fails a floor'}</Badge>}
      >
        <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-3">
          <LiquidityTile label="Today" value={a.liquidity.day} min={a.liquidity.minDay} />
          <LiquidityTile label="Last 5 sessions (week)" value={a.liquidity.week} min={a.liquidity.minWeek} />
          <LiquidityTile label="Last 21 sessions (month)" value={a.liquidity.month} min={a.liquidity.minMonth} />
        </motion.div>
      </Card>

      {/* Positives / negatives */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="What supports buying" subtitle={`${a.positives.length} checks passed`}>
          <BulletList items={a.positives} tone="success" empty="Nothing in favour right now." />
        </Card>
        <Card title="What argues against" subtitle={`${a.negatives.length} warnings / failures`}>
          <BulletList items={a.negatives} tone="danger" empty="No red flags from the checklist." />
        </Card>
      </div>

      {/* AI analyst */}
      <AiSection a={a} />

      {/* Checklist */}
      <Card title={<Term k="checklistScore">Stock-picking checklist</Term>} subtitle="Every rule the daily model uses, applied to this stock" padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Group</th>
                <th>Check</th>
                <th>Status</th>
                <th className="text-right">Value</th>
                <th>Why</th>
              </tr>
            </thead>
            <motion.tbody variants={staggerList} initial="hidden" animate="show">
              {groups.map((g) =>
                a.checklist
                  .filter((c) => c.group === g)
                  .map((c, i) => <ChecklistRow key={c.id} c={c} group={i === 0 ? g : ''} />),
              )}
            </motion.tbody>
          </table>
        </div>
      </Card>

      {/* Returns + risk */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card title={<Term k="relativeStrength">Performance vs NIFTY</Term>} padded={false}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Horizon</th>
                <th className="text-right">Stock</th>
                <th className="text-right">NIFTY</th>
                <th className="text-right">Excess</th>
              </tr>
            </thead>
            <tbody>
              {a.returns.map((r) => (
                <tr key={r.label}>
                  <td className="font-medium">{r.label}</td>
                  <td className={clsx('num', signCls(r.stock))}>{pct(r.stock, 1, true)}</td>
                  <td className={clsx('num', signCls(r.nifty))}>{pct(r.nifty, 1, true)}</td>
                  <td className={clsx('num font-semibold', signCls(r.excess))}>{pct(r.excess, 1, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Risk profile" subtitle="Trailing 1 year">
          <motion.div variants={staggerList} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Beta vs NIFTY" tip="beta" value={fmt(a.risk.beta1y, 2)} sub={`correlation ${fmt(a.risk.correlation1y, 2)}`} tone={(a.risk.beta1y ?? 1) > 1.3 ? 'warning' : 'neutral'} />
            <StatTile label="Annualised volatility" tip="annualVol" value={pct(a.risk.annualVolPct, 0)} sub={`ATR ${pct(a.risk.atrPct, 1)} / day`} />
            <StatTile label="Max drawdown (1y)" tip="maxDrawdown" value={pct(a.risk.maxDrawdown1yPct, 1)} tone="danger" sub={`now ${pct(a.risk.drawdownFrom52wHighPct, 1)} from 52w high`} />
            <StatTile label="Avg daily turnover" tip="turnover" value={a.risk.avgTurnoverCr === null ? '–' : `₹${fmt(a.risk.avgTurnoverCr, 1)} Cr`} sub="20-day average" />
            {a.levels ? (
              <>
                <StatTile label="Trade plan" tip="riskReward" value={`${fmt(a.levels.riskReward, 2)} : 1`} tone="info" sub={`target ${inr(a.levels.target)} · stop ${inr(a.levels.stopLoss)}`} />
                <StatTile label="Holding period" tip="holdDays" value={`${a.levels.holdDays} sessions`} sub={`risk −${fmt(a.levels.riskPct, 1)}% · reward +${fmt(a.levels.rewardPct, 1)}%`} />
              </>
            ) : (
              <StatTile label="Trade plan" value="—" sub="no setup triggered today" className="sm:col-span-2" />
            )}
          </motion.div>
        </Card>
      </div>

      {/* Stress + history */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<Term k="stress">Behaviour under market stress</Term>} subtitle="Last ~3 years · proxy for macro / geopolitical sensitivity" padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th className="text-right">Days</th>
                  <th className="text-right">Stock avg</th>
                  <th className="text-right">NIFTY avg</th>
                  <th className="text-right">Stock up %</th>
                  <th className="text-right">Next day</th>
                </tr>
              </thead>
              <tbody>
                {a.stress.map((s) => (
                  <tr key={s.id} title={s.description}>
                    <td>
                      <p className="font-medium">{s.label}</p>
                      <p className="max-w-[260px] truncate text-[11px] text-ink-500">{s.description}</p>
                    </td>
                    <td className="num">{s.days}</td>
                    <td className={clsx('num font-semibold', signCls(s.stockAvg))}>{pct(s.stockAvg, 2, true)}</td>
                    <td className={clsx('num', signCls(s.niftyAvg))}>{pct(s.niftyAvg, 2, true)}</td>
                    <td className="num">{s.stockUpPct === null ? '–' : `${fmt(s.stockUpPct, 0)}%`}</td>
                    <td className={clsx('num', signCls(s.nextDayStockAvg))}>{pct(s.nextDayStockAvg, 2, true)}</td>
                  </tr>
                ))}
                {!a.stress.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-ink-500">
                      NIFTY history needed for stress analysis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={<Term k="conditional">What this stock's own history says</Term>} subtitle="Forward returns after similar conditions (median · % positive)" padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Condition</th>
                  <th className="text-right">Cases</th>
                  <th className="text-right">+5d</th>
                  <th className="text-right">+10d</th>
                  <th className="text-right">+20d</th>
                </tr>
              </thead>
              <tbody>
                {a.conditional.map((c) => (
                  <tr key={c.id} title={c.description}>
                    <td>
                      <p className="font-medium">{c.label}</p>
                      <p className="max-w-[260px] truncate text-[11px] text-ink-500">{c.description}</p>
                    </td>
                    <td className="num">{c.occurrences}</td>
                    <Fwd m={c.medianFwd5} w={c.winRate5} />
                    <Fwd m={c.medianFwd10} w={c.winRate10} />
                    <Fwd m={c.medianFwd20} w={c.winRate20} />
                  </tr>
                ))}
                {!a.conditional.length && (
                  <tr>
                    <td colSpan={5} className="text-center text-ink-500">
                      Not enough history for conditional statistics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* News */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Company news" subtitle="Google News · most recent first">
          {a.newsError && <Callout tone="warning">{a.newsError}</Callout>}
          <NewsList items={a.news} />
        </Card>
        <Card title="Sector & macro news" subtitle={a.sector !== 'Unclassified' ? a.sector : 'Sector unknown'}>
          <NewsList items={a.sectorNews} />
        </Card>
      </div>

      <Card title="System pick history for this stock" padded={false}>
        {a.pickHistory.length ? <PicksTable picks={a.pickHistory} /> : <p className="p-5 text-sm text-ink-500">Never selected by the daily model so far.</p>}
      </Card>

      <p className="text-xs leading-relaxed text-ink-500">
        {a.caveat}{' '}
        <Link to={`/stocks/${a.symbol}`} className="text-brand-700 hover:underline">
          Open price chart →
        </Link>
      </p>
    </div>
  )
}

function ChecklistRow({ c, group }: { c: ChecklistItem; group: string }) {
  return (
    <motion.tr variants={fadeUp}>
      <td className="text-xs font-semibold uppercase tracking-wide text-ink-500">{group}</td>
      <td className="font-medium">
        {c.label}
        {CHECK_TIPS[c.id] && <InfoTip term={CHECK_TIPS[c.id]} className="ml-1" />}
        {c.critical && <span className="ml-1 text-[10px] uppercase text-ink-400">critical</span>}
      </td>
      <td>
        <Badge tone={statusTone(c.status)}>{c.status === 'NA' ? 'n/a' : c.status.toLowerCase()}</Badge>
      </td>
      <td className="num">{c.value}</td>
      <td className="max-w-[460px] whitespace-normal text-ink-600">{c.detail}</td>
    </motion.tr>
  )
}

function Fwd({ m, w }: { m: number | null; w: number | null }) {
  return (
    <td className="num">
      <span className={clsx('font-semibold', signCls(m))}>{pct(m, 1, true)}</span>
      <span className="ml-1 text-[11px] text-ink-400">{w === null ? '' : `${fmt(w, 0)}%↑`}</span>
    </td>
  )
}

function BulletList({ items, tone, empty }: { items: string[]; tone: Tone; empty: string }) {
  if (!items.length) return <p className="text-sm text-ink-500">{empty}</p>
  return (
    <motion.ul variants={staggerList} initial="hidden" animate="show" className="space-y-1.5 text-sm text-ink-700">
      {items.map((t, i) => (
        <motion.li key={i} variants={fadeUp} className="flex gap-2">
          <span className={clsx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', tone === 'success' ? 'bg-up-600' : 'bg-down-600')} />
          <span>{t}</span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">No recent headlines found.</p>
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((n) => (
        <li key={n.url} className="py-2">
          <a href={n.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3 text-sm">
            <span className="text-ink-900 group-hover:text-brand-700">{n.title}</span>
            <ExternalLink size={13} className="mt-1 shrink-0 text-ink-400" />
          </a>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {n.source ?? 'news'} · {n.publishedAt ? timeAgo(n.publishedAt) : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

function AiSection({ a }: { a: StockAnalysisDto }) {
  const { data, isLoading, error } = useAiNote(a.symbol, a.aiAvailable)
  const ask = useAskAnalyst(a.symbol)
  const [q, setQ] = useState('')
  const note = data?.status === 'OK' ? data.note : null
  const tone: Tone = note ? (note.sentiment === 'POSITIVE' ? 'success' : note.sentiment === 'NEGATIVE' ? 'danger' : 'warning') : 'neutral'
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles size={16} className="text-violet-600" /> AI analyst — news &amp; macro impact
        </span>
      }
      subtitle={note ? `${note.model} · generated ${timeAgo(note.generatedAt)}` : 'Reads the headlines above plus the fact sheet and explains how news, geopolitics and macro forces bear on this stock'}
      action={note && <span className="inline-flex items-center gap-1"><Badge tone={verdictTone(note.stance)} size="md">AI stance: {verdictLabel(note.stance)}</Badge><InfoTip term="aiStance" /></span>}
    >
      {!a.aiAvailable && <Callout tone="neutral">AI analyst is disabled (ANALYST_AI_ENABLED=false).</Callout>}
      {a.aiAvailable && isLoading && (
        <div className="flex items-center gap-3 text-sm text-ink-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Reading {a.news.length + a.sectorNews.length} headlines and the fact sheet… this takes 15–40 seconds the first time.
        </div>
      )}
      {a.aiAvailable && error && <Callout tone="danger">{(error as Error).message}</Callout>}
      {data && data.status !== 'OK' && (
        <Callout tone={data.status === 'DISABLED' ? 'warning' : 'danger'} title={data.status === 'DISABLED' ? 'AI analyst not configured' : 'AI analyst error'}>
          {data.message}
          {data.status === 'DISABLED' && (
            <p className="mt-1 text-xs">
              The quantitative checklist, stress statistics and headlines above do not need it. To enable the narrative, add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> and restart the API.
            </p>
          )}
        </Callout>
      )}
      {note && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <p className="text-sm leading-relaxed text-ink-800">{note.summary}</p>
            <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3">
              <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">News sentiment <InfoTip term="sentiment" /></p>
              <p className={clsx('mt-1 text-xl font-semibold', tone === 'success' ? 'text-up-700' : tone === 'danger' ? 'text-down-700' : 'text-warn-700')}>
                {note.sentiment.toLowerCase()} <span className="text-sm tnum text-ink-500">({note.sentimentScore > 0 ? '+' : ''}{note.sentimentScore})</span>
              </p>
              <ProgressBar value={(note.sentimentScore + 100) / 2} tone={tone} className="mt-2" />
              <p className="mt-2 text-xs text-ink-600">{note.stanceReason}</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Impact of recent news" body={note.newsImpact} />
            <Section title={<Term k="macroExposure">Geopolitical & macro exposure</Term>} body={note.macroExposure} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ListBox title="Positives" items={note.positives} tone="success" />
            <ListBox title="Negatives" items={note.negatives} tone="danger" />
            <ListBox title="Risks to watch" items={note.risks} tone="warning" />
            <ListBox title="Catalysts" items={note.catalysts} tone="info" />
          </div>
        </div>
      )}

      {a.aiAvailable && (
        <form
          className="mt-5 border-t border-ink-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim().length >= 3) ask.mutate(q.trim())
          }}
        >
          <label className="text-xs font-medium text-ink-700" htmlFor="ask">
            Ask the analyst about this stock
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ask"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. How would an escalation in the Middle East / rising crude affect this stock?"
              className="h-9 flex-1 rounded-lg border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-400 focus:border-brand-500"
            />
            <Button type="submit" loading={ask.isPending} disabled={q.trim().length < 3}>
              Ask
            </Button>
          </div>
          {ask.error && <Callout tone="danger">{(ask.error as Error).message}</Callout>}
          {ask.data && (
            <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-ink-800">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-600">Q: {ask.data.question}</p>
              {ask.data.answer.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="mt-2 whitespace-pre-wrap first:mt-0">
                  {p}
                </p>
              ))}
            </div>
          )}
        </form>
      )}
    </Card>
  )
}

const inrCompact = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString('en-IN')}`)

function LiquidityTile({ label, value, min }: { label: string; value: number; min: number }) {
  const ok = value >= min
  const ratio = min > 0 ? value / min : 0
  return (
    <motion.div variants={fadeUp} className={clsx('rounded-xl border p-4', ok ? 'border-up-100 bg-up-50/40' : 'border-down-100 bg-down-50/40')}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold tnum', ok ? 'text-up-700' : 'text-down-700')}>{inrCompact(value)}</p>
      <p className="mt-1 text-xs text-ink-600">
        minimum {inrCompact(min)} · {ratio >= 1 ? `${ratio >= 100 ? Math.round(ratio) : ratio.toFixed(1)}× the floor` : `${(ratio * 100).toFixed(0)}% of the floor`}
      </p>
      <ProgressBar value={Math.min(100, ratio * 100)} tone={ok ? 'success' : 'danger'} className="mt-2" />
    </motion.div>
  )
}

function Section({ title, body }: { title: React.ReactNode; body: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-800 whitespace-pre-wrap">{body}</p>
    </div>
  )
}

function ListBox({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  const dot = { success: 'bg-up-600', danger: 'bg-down-600', warning: 'bg-warn-600', info: 'bg-brand-500', neutral: 'bg-ink-400', violet: 'bg-violet-600' }[tone]
  return (
    <div className="rounded-lg border border-ink-100 p-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</h4>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-ink-700">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className={clsx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-400">—</p>
      )}
    </div>
  )
}
