import clsx from 'clsx'
import { Activity, BarChart3, Database, FlaskConical, LayoutDashboard, ListOrdered, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useDataStatus, useMarketOverview } from '../../lib/api'
import { StockSearch } from '../StockSearch'
import { dateShort, regimeLabel, regimeTone } from '../../lib/format'
import { Badge } from '../ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/picks', label: 'Daily Picks', icon: ListOrdered },
  { to: '/analyst', label: 'Stock Analyst', icon: Sparkles },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/data', label: 'Data', icon: Database },
]

export function AppShell() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-ink-100 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">NSE Picks</p>
            <p className="text-[11px] text-ink-500">Quant selection system</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100',
                )
              }
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <DataFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function TopBar() {
  const { data: overview } = useMarketOverview()
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 lg:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Activity size={18} />
        </span>
        <nav className="flex gap-1 overflow-x-auto" aria-label="Primary (compact)">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('rounded-md px-2 py-1 text-xs font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="hidden w-full max-w-sm sm:block">
        <StockSearch placeholder="Search symbol or company…" />
      </div>
      <div className="flex items-center gap-3 text-sm">
        {overview ? (
          <>
            <span className="hidden text-ink-500 sm:inline">As of {dateShort(overview.date)}</span>
            <Badge tone={regimeTone(overview.regime)} size="md">
              {regimeLabel(overview.regime)}
            </Badge>
            <span className="hidden items-center gap-1.5 tnum text-ink-700 md:flex">
              NIFTY <strong>{overview.nifty.close.toLocaleString('en-IN')}</strong>
              <span className={overview.nifty.changePct >= 0 ? 'text-up-600' : 'text-down-600'}>
                {overview.nifty.changePct >= 0 ? '+' : ''}
                {overview.nifty.changePct.toFixed(2)}%
              </span>
            </span>
          </>
        ) : (
          <Badge tone="neutral" size="md">
            No run yet
          </Badge>
        )}
      </div>
    </header>
  )
}

function DataFooter() {
  const { data } = useDataStatus()
  return (
    <div className="border-t border-ink-100 px-5 py-3 text-[11px] leading-relaxed text-ink-500">
      <p>
        Data through <span className="font-medium text-ink-700">{dateShort(data?.lastDate)}</span>
      </p>
      <p>
        {data ? `${data.symbols.toLocaleString()} symbols · ${data.tradingDays} days` : 'Loading…'}
      </p>
      {data?.job?.status === 'RUNNING' && <p className="mt-1 text-brand-700">{data.job.type.toLowerCase()} running…</p>}
    </div>
  )
}
