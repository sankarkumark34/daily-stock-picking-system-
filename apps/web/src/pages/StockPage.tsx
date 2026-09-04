import clsx from 'clsx'
import { motion } from 'motion/react'
import { useParams } from 'react-router'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Callout, Card, KV, Skeleton, StatTile, Term, staggerList } from '../components/ui'
import { useStock } from '../lib/api'
import { compact, dateLong, dateShort, fmt, inr, pct } from '../lib/format'
import { PicksTable } from './PicksPage'

export function StockPage() {
  const { symbol } = useParams()
  const { data, isLoading, error } = useStock(symbol)

  if (isLoading) return <Skeleton className="h-96" />
  if (error) return <Callout tone="danger">{(error as Error).message}</Callout>
  if (!data) return null

  const bars = data.bars
  const chart = bars.map((b, i) => ({
    date: b.date,
    close: b.close,
    ema21: data.indicators.ema21[i],
    ema50: data.indicators.ema50[i],
    sma200: data.indicators.sma200[i],
    rsi: data.indicators.rsi14[i],
    volume: b.volume,
  }))
  const l = data.latest
  const num = (k: string) => (typeof l[k] === 'number' ? (l[k] as number) : null)
  const chg = num('changePct')

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">{data.symbol}</h1>
            <Badge tone="neutral">{data.sector}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {data.name ?? '—'} · last close {dateLong(String(l.date))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tnum">{inr(num('close'))}</p>
          <p className={clsx('text-sm tnum', (chg ?? 0) >= 0 ? 'text-up-600' : 'text-down-600')}>{pct(chg, 2, true)}</p>
        </div>
      </div>

      <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="RSI 14" tip="rsi" value={fmt(num('rsi14'), 1)} tone={(num('rsi14') ?? 50) > 70 ? 'warning' : (num('rsi14') ?? 50) < 30 ? 'danger' : 'neutral'} sub={`Stoch RSI ${fmt(num('stochRsi'), 0)} · MACD hist ${fmt(num('macdHist'), 2)}`} />
        <StatTile label="ATR 14" tip="atr" value={`${fmt(num('atrPct'), 2)}%`} sub={`₹${fmt(num('atr14'), 2)} · HV20 ${fmt(num('hv20'), 0)}%`} />
        <StatTile label="ADX 14" tip="adx" value={fmt(num('adx14'), 1)} tone={(num('adx14') ?? 0) >= 25 ? 'success' : 'neutral'} sub={`Supertrend ${num('supertrendDir') === 1 ? 'bullish' : 'bearish'}`} />
        <StatTile label="Relative volume" tip="relVol" value={`${fmt(num('relVol'), 2)}×`} tone={(num('relVol') ?? 1) >= 1.5 ? 'info' : 'neutral'} sub={`avg 20d turnover ₹${compact(num('avgTurnover20'))}`} />
      </motion.div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Price with EMA 21 / EMA 50 / SMA 200" subtitle={`${bars.length} sessions`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={40} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => fmt(Number(v), 0)} />
                <Tooltip labelFormatter={(x) => dateLong(String(x))} formatter={(v) => inr(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <Line type="monotone" dataKey="close" name="Close" stroke="#0f172a" dot={false} strokeWidth={1.6} isAnimationActive={false} />
                <Line type="monotone" dataKey="ema21" name="EMA 21" stroke="#2f5fe0" dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="ema50" name="EMA 50" stroke="#d97706" dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="sma200" name="SMA 200" stroke="#e11d48" dot={false} strokeWidth={1.2} strokeDasharray="4 3" isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <ReferenceLine y={70} stroke="#e11d48" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#059669" strokeDasharray="3 3" />
                <Tooltip labelFormatter={(x) => dateLong(String(x))} formatter={(v) => fmt(Number(v), 1)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                <Line type="monotone" dataKey="rsi" name="RSI 14" stroke="#7c3aed" dot={false} strokeWidth={1.3} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Latest indicator snapshot">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div>
              <KV k={<Term k="ema">EMA 9 / 21 / 50</Term>} v={`${fmt(num('ema9'), 1)} / ${fmt(num('ema21'), 1)} / ${fmt(num('ema50'), 1)}`} />
              <KV k={<Term k="sma">SMA 20 / 50 / 200</Term>} v={`${fmt(num('sma20'), 1)} / ${fmt(num('sma50'), 1)} / ${fmt(num('sma200'), 1)}`} />
              <KV k={<Term k="macd">MACD line / signal</Term>} v={`${fmt(num('macdLine'), 2)} / ${fmt(num('macdSignal'), 2)}`} />
              <KV k={<Term k="roc">ROC 10 / 20</Term>} v={`${pct(num('roc10'), 1, true)} / ${pct(num('roc20'), 1, true)}`} />
              <KV k={<Term k="cci">CCI 20</Term>} v={fmt(num('cci20'), 0)} />
              <KV k={<Term k="bollinger">Bollinger %B / width</Term>} v={`${fmt(num('bbPctB'), 2)} / ${fmt(num('bbWidth'), 1)}%`} />
            </div>
            <div>
              <KV k="Return 1d / 5d" v={`${pct(num('ret1'), 1, true)} / ${pct(num('ret5'), 1, true)}`} />
              <KV k="Return 20d / 60d" v={`${pct(num('ret20'), 1, true)} / ${pct(num('ret60'), 1, true)}`} />
              <KV k="20d high / low" v={`${fmt(num('priorHigh20'), 1)} / ${fmt(num('priorLow20'), 1)}`} />
              <KV k={<Term k="dist52w">52w high / low</Term>} v={`${fmt(num('high252'), 1)} / ${fmt(num('low252'), 1)}`} />
              <KV k={<Term k="obv">OBV slope 10d</Term>} v={fmt(num('obvSlope10'), 2)} />
              <KV k={<Term k="delivery">Delivery % (20d avg)</Term>} v={num('avgDeliveryPct20') === null ? 'n/a' : `${fmt(num('avgDeliveryPct20'), 0)}%`} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Pick history for this stock" padded={false}>
        {data.history.length ? (
          <PicksTable picks={data.history} />
        ) : (
          <p className="p-5 text-sm text-ink-500">This stock has not appeared in the live picks yet.</p>
        )}
      </Card>
    </>
  )
}
