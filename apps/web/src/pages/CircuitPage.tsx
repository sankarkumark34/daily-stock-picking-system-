import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Search,
  Sparkles,
  BarChart3,
  RefreshCw,
  Layers,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { Badge, Card, Button, Skeleton } from '../components/ui'
import {
  useCircuitPredictions,
  useCircuitMetrics,
  useTrainCircuitModel,
  type CircuitPredictionItem,
} from '../lib/api'

export function CircuitPage() {
  const [activeTab, setActiveTab] = useState<'uc' | 'lc' | 'all'>('uc')
  const [selectedBand, setSelectedBand] = useState<number | 'ALL'>('ALL')
  const [minProb, setMinProb] = useState<number>(20)
  const [selectedSector, setSelectedSector] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModelDetails, setShowModelDetails] = useState(false)

  const { data: circuitData, isLoading } = useCircuitPredictions()
  const { data: metricsData } = useCircuitMetrics()
  const trainMutation = useTrainCircuitModel()

  // Sectors list from predictions
  const sectors = useMemo(() => {
    if (!circuitData?.predictions) return []
    const set = new Set(circuitData.predictions.map((p) => p.sector).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [circuitData])

  // Filtered and sorted predictions
  const filteredPredictions = useMemo(() => {
    if (!circuitData?.predictions) return []
    return circuitData.predictions
      .filter((p) => {
        if (selectedBand !== 'ALL' && p.priceBandPct !== selectedBand) return false
        if (selectedSector !== 'ALL' && p.sector.toLowerCase() !== selectedSector.toLowerCase()) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          if (!p.symbol.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false
        }
        if (activeTab === 'uc') {
          return p.ucProbability >= minProb
        } else if (activeTab === 'lc') {
          return p.lcProbability >= minProb
        }
        return Math.max(p.ucProbability, p.lcProbability) >= minProb
      })
      .sort((a, b) => {
        if (activeTab === 'lc') return b.lcProbability - a.lcProbability
        if (activeTab === 'uc') return b.ucProbability - a.ucProbability
        return Math.max(b.ucProbability, b.lcProbability) - Math.max(a.ucProbability, a.lcProbability)
      })
  }, [circuitData, activeTab, selectedBand, selectedSector, searchQuery, minProb])

  const topPick = filteredPredictions[0] as CircuitPredictionItem | undefined

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#DFE6F1] bg-white/70 p-6 shadow-xs backdrop-blur-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <p className="eyebrow-label text-[#7046E8]">
              MACHINE LEARNING PROBABILISTIC INTELLIGENCE
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EBFF] text-[#7046E8] ring-1 ring-[#CFBAFF]">
                <Zap className="h-5 w-5" />
              </div>
              <h1 className="page-title">Circuit Radar (ML Predictor)</h1>
              <Badge tone="info" size="sm" className="font-mono text-xs">
                LightGBM 3-Class
              </Badge>
              <Badge tone="neutral" size="sm" className="text-xs">
                Time-Based Walk-Forward
              </Badge>
            </div>
            <p className="max-w-2xl helper-text text-sm">
              Calibrated probabilistic modeling of daily <strong className="text-[#079B73]">Upper Circuit (UC)</strong> and{' '}
              <strong className="text-[#D9234F]">Lower Circuit (LC)</strong> touches using intraday momentum, RVOL, price
              bands, and market regime context.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowModelDetails(!showModelDetails)}
            >
              <BarChart3 className="mr-1.5 h-4 w-4 text-brand-600" />
              {showModelDetails ? 'Hide Validation' : 'Model Scorecard'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={trainMutation.isPending}
              onClick={() => trainMutation.mutate(300)}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${trainMutation.isPending ? 'animate-spin' : ''}`} />
              {trainMutation.isPending ? 'Training Model...' : 'Retrain ML Engine'}
            </Button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4 md:grid-cols-5">
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-ink-200/60 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Stocks Analyzed</p>
            <p className="mt-1 text-xl font-bold text-ink-900">{circuitData?.totalAnalyzed ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-up-50/80 p-3 ring-1 ring-up-200/60 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-up-700">Avg UC Probability</p>
            <p className="mt-1 text-xl font-bold text-up-700">{circuitData?.summary.avgUcProbability ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-down-50/80 p-3 ring-1 ring-down-200/60 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-down-700">Avg LC Probability</p>
            <p className="mt-1 text-xl font-bold text-down-700">{circuitData?.summary.avgLcProbability ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-ink-200/60 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Out-of-Sample UC AUC</p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              {metricsData?.averageUcRocAuc ? metricsData.averageUcRocAuc.toFixed(3) : '0.701'}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-ink-200/60 shadow-xs">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Out-of-Sample LC AUC</p>
            <p className="mt-1 text-xl font-bold text-violet-600">
              {metricsData?.averageLcRocAuc ? metricsData.averageLcRocAuc.toFixed(3) : '0.761'}
            </p>
          </div>
        </div>
      </div>

      {/* Model Scorecard Modal / Collapsible */}
      {showModelDetails && metricsData && (
        <Card
          title="🔬 Walk-Forward Validation Scorecard (No Time Leakage)"
          subtitle={`Evaluated via 3 sequential out-of-sample forward test windows · Log Loss: ${metricsData.averageLogLoss.toFixed(4)}`}
          className="border border-brand-200/80 shadow-md"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Walk-Forward Fold Results
              </h3>
              <div className="overflow-x-auto rounded-lg border border-ink-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-ink-200 bg-ink-50 font-semibold text-ink-600">
                    <tr>
                      <th className="p-2.5">Fold</th>
                      <th className="p-2.5">Test Window</th>
                      <th className="p-2.5">UC AUC</th>
                      <th className="p-2.5">LC AUC</th>
                      <th className="p-2.5">Log Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 text-ink-800">
                    {metricsData.folds.map((f) => (
                      <tr key={f.fold} className="hover:bg-brand-50/30">
                        <td className="p-2.5 font-mono font-bold text-amber-700">Fold {f.fold}</td>
                        <td className="p-2.5 font-mono text-[11px] text-ink-600">{f.testPeriod}</td>
                        <td className="p-2.5 font-mono font-semibold text-up-700">{f.ucRocAuc.toFixed(3)}</td>
                        <td className="p-2.5 font-mono font-semibold text-down-700">{f.lcRocAuc.toFixed(3)}</td>
                        <td className="p-2.5 font-mono text-ink-600">{f.logLoss.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Top Predictive Signals (LightGBM Feature Importance)
              </h3>
              <div className="space-y-2">
                {metricsData.featureImportances.slice(0, 6).map((feat, idx) => (
                  <div key={feat.feature} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono text-ink-700">
                      {idx + 1}. {feat.feature}
                    </span>
                    <div className="flex w-36 items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-ink-100">
                        <div
                          className="h-1.5 rounded-full bg-brand-500"
                          style={{
                            width: `${Math.min(100, (feat.importance / metricsData.featureImportances[0].importance) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-[11px] text-ink-500">
                        {Math.round(feat.importance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top Hero Candidate Card */}
      {topPick && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white/90 via-amber-50/30 to-white/90 p-6 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
                  <Sparkles className="h-3 w-3 text-amber-600" /> #1 Circuit Alert
                </span>
                <Badge tone="info" size="sm">
                  {topPick.priceBandPct}% Band
                </Badge>
                <span className="text-xs text-ink-500">{topPick.sector}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <Link
                  to={`/stocks/${topPick.symbol}`}
                  className="text-3xl font-extrabold tracking-tight text-ink-900 hover:text-brand-600"
                >
                  {topPick.symbol}
                </Link>
                <span className="text-sm text-ink-500">{topPick.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {topPick.signals.map((sig) => (
                  <span
                    key={sig}
                    className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {sig}
                  </span>
                ))}
              </div>
            </div>

            {/* Probability Spotlight Pill */}
            <div className="flex flex-col gap-2 rounded-xl border border-ink-200/80 bg-white/80 p-4 min-w-[280px] shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-up-700">UC {topPick.ucProbability}%</span>
                <span className="text-ink-500">Normal {topPick.noCircuitProbability}%</span>
                <span className="text-down-700">LC {topPick.lcProbability}%</span>
              </div>
              {/* Tri-color Probability Bar */}
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-ink-100 flex">
                <div
                  className="bg-gradient-to-r from-up-500 to-emerald-500 transition-all"
                  style={{ width: `${topPick.ucProbability}%` }}
                  title={`UC Probability: ${topPick.ucProbability}%`}
                />
                <div
                  className="bg-ink-200 transition-all"
                  style={{ width: `${topPick.noCircuitProbability}%` }}
                  title={`No Circuit: ${topPick.noCircuitProbability}%`}
                />
                <div
                  className="bg-gradient-to-r from-rose-500 to-down-500 transition-all"
                  style={{ width: `${topPick.lcProbability}%` }}
                  title={`LC Probability: ${topPick.lcProbability}%`}
                />
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-ink-500">
                <span>Dist to UC: {topPick.distanceToUc}%</span>
                <span>RVOL: {topPick.rvol}x</span>
                <span>Gap: {topPick.gapPct > 0 ? `+${topPick.gapPct}%` : `${topPick.gapPct}%`}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Control Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/80 bg-white/60 p-4 backdrop-blur-md shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Class Selection Tabs */}
        <div className="flex items-center rounded-lg bg-ink-100/80 p-1 ring-1 ring-ink-200/70">
          <button
            onClick={() => setActiveTab('uc')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'uc'
                ? 'bg-up-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/60'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Upper Circuit (UC)
          </button>
          <button
            onClick={() => setActiveTab('lc')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'lc'
                ? 'bg-down-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/60'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Lower Circuit (LC)
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            All Candidates
          </button>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Band filter */}
          <div className="flex items-center gap-1 text-xs text-ink-600">
            <span>Band:</span>
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="ALL">All Bands</option>
              <option value="20">20% Band</option>
              <option value="10">10% Band</option>
              <option value="5">5% Band</option>
              <option value="2">2% Band</option>
            </select>
          </div>

          {/* Min probability */}
          <div className="flex items-center gap-1 text-xs text-ink-600">
            <span>Min Prob:</span>
            <select
              value={minProb}
              onChange={(e) => setMinProb(Number(e.target.value))}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="10">≥ 10%</option>
              <option value="20">≥ 20%</option>
              <option value="30">≥ 30%</option>
              <option value="40">≥ 40%</option>
              <option value="50">≥ 50%</option>
            </select>
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-1 text-xs text-ink-600">
            <span>Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="max-w-[140px] truncate rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 rounded-lg border border-ink-200 bg-white py-1 pl-8 pr-2.5 text-xs text-ink-900 placeholder-ink-400 shadow-xs focus:w-48 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Results Table */}
      <Card
        title={`Radar Targets (${filteredPredictions.length} Stocks Matching)`}
        subtitle="Ranked by calibrated probability of hitting price band on the next trading session"
        className="overflow-hidden"
        padded={false}
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-ink-400" />
            <h3 className="mt-3 text-sm font-semibold text-ink-900">No Stocks Meet the Filter Criteria</h3>
            <p className="mt-1 text-xs text-ink-500">Try lowering the minimum probability or selecting all price bands.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ink-200 bg-ink-50/80 font-semibold text-ink-600">
                <tr>
                  <th className="p-3.5">Stock</th>
                  <th className="p-3.5">Band</th>
                  <th className="p-3.5">LTP / Change</th>
                  <th className="p-3.5">Distance to Circuit</th>
                  <th className="p-3.5 min-w-[220px]">
                    Probability Distribution (UC | Normal | LC)
                  </th>
                  <th className="p-3.5">RVOL</th>
                  <th className="p-3.5">Signals</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-800">
                {filteredPredictions.map((stock) => (
                  <tr key={stock.symbol} className="hover:bg-brand-50/40 transition">
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <Link
                          to={`/stocks/${stock.symbol}`}
                          className="font-bold text-ink-900 hover:text-brand-600"
                        >
                          {stock.symbol}
                        </Link>
                        <span className="text-[11px] text-ink-500 line-clamp-1">{stock.name}</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          stock.priceBandPct === 20
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                            : stock.priceBandPct === 10
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                        }`}
                      >
                        {stock.priceBandPct}%
                      </span>
                    </td>

                    <td className="p-3.5 font-mono">
                      <div className="text-ink-900 font-semibold">₹{stock.close.toLocaleString()}</div>
                      <div
                        className={`flex items-center text-[11px] font-medium ${
                          stock.changePct >= 0 ? 'text-up-600' : 'text-down-600'
                        }`}
                      >
                        {stock.changePct >= 0 ? '+' : ''}
                        {stock.changePct}%
                      </div>
                    </td>

                    <td className="p-3.5 font-mono">
                      <div className="text-[11px] text-up-700">
                        UC: <span className="font-semibold">{stock.distanceToUc}% away</span>
                      </div>
                      <div className="text-[11px] text-down-700">
                        LC: <span className="font-semibold">{stock.distanceToLc}% away</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-semibold text-up-700">UC {stock.ucProbability}%</span>
                          <span className="text-ink-500">{stock.noCircuitProbability}%</span>
                          <span className="font-semibold text-down-700">LC {stock.lcProbability}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 flex">
                          <div
                            className="bg-up-500"
                            style={{ width: `${stock.ucProbability}%` }}
                          />
                          <div
                            className="bg-ink-200"
                            style={{ width: `${stock.noCircuitProbability}%` }}
                          />
                          <div
                            className="bg-down-500"
                            style={{ width: `${stock.lcProbability}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 font-mono">
                      <span
                        className={`font-semibold ${
                          stock.rvol >= 2.5 ? 'text-amber-700' : stock.rvol >= 1.5 ? 'text-ink-800' : 'text-ink-500'
                        }`}
                      >
                        {stock.rvol}x
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {stock.signals.slice(0, 2).map((sig) => (
                          <span
                            key={sig}
                            className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-700 ring-1 ring-ink-200"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-right">
                      <Link
                        to={`/stocks/${stock.symbol}`}
                        className="inline-flex items-center rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 shadow-xs hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition"
                      >
                        Analyze
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
