import clsx from 'clsx'
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  FlaskConical,
  Info,
  LayoutDashboard,
  ListOrdered,
  Menu,
  Rocket,
  Settings,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useDataStatus, useLiveMarket, useMarketOverview } from '../../lib/api'
import { dateShort, regimeLabel, regimeTone } from '../../lib/format'
import { LiveBadge, LivePrice } from '../LivePrice'
import { StockSearch } from '../StockSearch'
import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/circuit', label: 'Circuit Radar', icon: Zap },
  { to: '/elite', label: 'Elite Pick', icon: Star, highlight: true },
  { to: '/picks', label: 'Daily Picks', icon: ListOrdered },
  { to: '/analyst', label: 'Stock Analyst', icon: Sparkles },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/ipos', label: 'Upcoming IPOs', icon: Rocket },
  { to: '/data', label: 'Data', icon: Database },
]

export function AppShell() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop Sidebar (Design Spec §5.1: 256px fixed width) ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#DFE6F1] bg-white/70 backdrop-blur-xl lg:flex rounded-r-2xl my-4 ml-4 shadow-[0_4px_24px_rgba(23,35,61,0.03)]">
        {/* Brand Header */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[#DFE6F1] px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7046E8] text-white shadow-xs">
            <Activity size={18} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-ink-950 tracking-tight">NSE Picks</p>
            <p className="text-[10.5px] font-medium text-ink-500">Quant selection system</p>
          </div>
        </div>

        {/* Primary Navigation (§6.1) */}
        <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150',
                  isActive
                    ? n.highlight
                      ? 'bg-[#FFF8E7] text-[#D88A00] border-l-2 border-[#D88A00] shadow-xs'
                      : 'bg-[#F0EBFF] text-[#7046E8] border-l-2 border-[#7046E8] shadow-xs'
                    : n.highlight
                      ? 'text-[#D88A00] hover:bg-[#FFF8E7]/70 hover:translate-x-0.5'
                      : 'text-ink-500 hover:bg-[#F0EBFF] hover:text-[#7046E8] hover:translate-x-0.5',
                )
              }
            >
              <n.icon size={16} className={n.highlight ? 'fill-amber-400 text-[#D88A00]' : undefined} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Settings Affordance & Live Data Status Footer (§6.1 items 3 & 4) */}
        <div className="border-t border-[#DFE6F1] p-3 space-y-2">
          <NavLink
            to="/data"
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-ink-500 hover:bg-[#F0EBFF] hover:text-[#7046E8] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings size={14} /> System Settings
            </span>
            <span className="text-[10px] font-bold text-ink-400">v0.1.0</span>
          </NavLink>
          <DataFooter />
        </div>
      </aside>

      {/* ── Mobile Off-Canvas Drawer (Design Spec §5.3) ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-xs lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-[#DFE6F1] bg-white p-4 shadow-2xl flex lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-[#DFE6F1] pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7046E8] text-white">
                    <Activity size={18} />
                  </span>
                  <p className="font-bold text-ink-900">NSE Picks</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 space-y-1 py-4" aria-label="Mobile Primary">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold',
                        isActive
                          ? n.highlight
                            ? 'bg-[#FFF8E7] text-[#D88A00] border-l-2 border-[#D88A00]'
                            : 'bg-[#F0EBFF] text-[#7046E8] border-l-2 border-[#7046E8]'
                          : 'text-ink-600 hover:bg-ink-50',
                      )
                    }
                  >
                    <n.icon size={16} />
                    {n.label}
                  </NavLink>
                ))}
              </nav>
              <DataFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        {/* Main Content (Design Spec §5.1: max-width 1480px, horizontal padding 28px) */}
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-[28px] py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { data: overview } = useMarketOverview()
  const { data: live } = useLiveMarket()

  return (
    <header className="sticky top-4 z-20 mx-4 lg:mx-8 mb-4 flex h-14 items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-[0_4px_24px_rgba(23,35,61,0.03)] px-4 sm:px-6">
      {/* Left: Mobile Menu Button */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold text-ink-900">NSE Picks</span>
      </div>

      {/* Center: Search input with clear focus ring (§6.2) */}
      <div className="hidden w-full max-w-sm sm:block">
        <StockSearch placeholder="Search symbol or company name…" />
      </div>

      {/* Right: Date Context, Market Regime, Live NIFTY/VIX, Notifications (§6.2) */}
      <div className="flex items-center gap-2.5 sm:gap-3 text-sm">
        {overview ? (
          <>
            <span className="hidden text-xs text-ink-500 xl:inline">
              As of {dateShort(overview.date)}
            </span>
            <Badge tone={regimeTone(overview.regime)} size="md">
              {regimeLabel(overview.regime)}
            </Badge>
            {live?.nifty ? (
              <span className="hidden items-center gap-2 md:flex">
                <span className="text-ink-500 text-xs">NIFTY</span>
                <LivePrice q={live.nifty} />
                {live.vix && (
                  <span className="hidden items-center gap-1 text-xs text-ink-500 lg:inline-flex">
                    · VIX <span className="tnum font-semibold text-ink-800">{live.vix.ltp.toFixed(2)}</span>
                  </span>
                )}
                <LiveBadge q={live.nifty} />
              </span>
            ) : (
              <span className="hidden items-center gap-1.5 tnum text-ink-700 md:flex">
                <span className="text-xs text-ink-500">NIFTY</span>
                <strong>{overview.nifty.close.toLocaleString('en-IN')}</strong>
                <span className={clsx('font-bold', overview.nifty.changePct >= 0 ? 'text-up-600' : 'text-down-600')}>
                  {overview.nifty.changePct >= 0 ? '+' : ''}
                  {overview.nifty.changePct.toFixed(2)}%
                </span>
                <span className="rounded bg-ink-100 px-1 py-0.5 text-[9px] font-bold text-ink-500 uppercase">EOD</span>
              </span>
            )}
          </>
        ) : (
          <Badge tone="neutral" size="md">
            No run yet
          </Badge>
        )}

        {/* Notifications Popover (§6.2 item 7 & §8) */}
        <Popover>
          <PopoverTrigger
            aria-label="View system notifications"
            className="relative grid h-8 w-8 place-items-center rounded-lg border border-[#DFE6F1] bg-white text-ink-600 hover:bg-[#F0EBFF] hover:text-[#7046E8] transition-colors"
          >
            <Bell size={15} />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#7046E8] ring-2 ring-white animate-pulse" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 shadow-xl border-[#DFE6F1]">
            <div className="border-b border-[#DFE6F1] px-4 py-3 bg-[#F8FAFF]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-ink-900">Quantitative Alerts</p>
                <span className="rounded-full bg-[#F0EBFF] px-2 py-0.5 text-[10px] font-bold text-[#7046E8]">
                  3 New
                </span>
              </div>
            </div>
            <div className="divide-y divide-[#DFE6F1]/60 text-xs">
              <div className="p-3 hover:bg-[#F8FAFF] transition-colors">
                <p className="font-semibold text-ink-900 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-up-600" /> Market Regime Confirmed
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {overview ? `${regimeLabel(overview.regime)} regime active with long bias ×${overview.longBias}.` : 'Daily quantitative regime computed.'}
                </p>
              </div>
              <div className="p-3 hover:bg-[#F8FAFF] transition-colors">
                <p className="font-semibold text-ink-900 flex items-center gap-1.5">
                  <Info size={13} className="text-[#7046E8]" /> Blockbuster IPO Listing Radar
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  4 closed IPOs (KRN, ARKADE, MANBA, BAJAJHFL) awaiting listing under SEBI T+3 rule.
                </p>
              </div>
              <div className="p-3 hover:bg-[#F8FAFF] transition-colors">
                <p className="font-semibold text-ink-900 flex items-center gap-1.5">
                  <Activity size={13} className="text-brand-600" /> Live Public Feed Active
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  Delayed by ~15 min during active market sessions.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}

function DataFooter() {
  const { data } = useDataStatus()
  return (
    <div className="rounded-xl border border-[#DFE6F1] bg-[#F8FAFF] p-3 text-[11px] leading-relaxed text-ink-500">
      <p className="font-semibold text-ink-700">
        Data through {dateShort(data?.lastDate)}
      </p>
      <p className="text-[10.5px]">
        {data ? `${data.symbols.toLocaleString()} symbols · ${data.tradingDays} days` : 'Loading…'}
      </p>
      {data?.job?.status === 'RUNNING' && (
        <p className="mt-1 font-bold text-[#7046E8] flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7046E8] animate-ping" />
          {data.job.type.toLowerCase()} running…
        </p>
      )}
    </div>
  )
}

