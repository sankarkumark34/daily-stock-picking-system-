import clsx from 'clsx'
import { Clock, Search, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePicks, useStockSearch } from '../lib/api'

const RECENT_KEY = 'nse-picks.recent-symbols'
const MAX_RECENT = 8

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]).filter(Boolean).slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    /* ignore */
  }
}
export function rememberSymbol(symbol: string) {
  const list = [symbol, ...loadRecent().filter((s) => s !== symbol)]
  saveRecent(list)
}

function highlight(text: string, tokens: string[]) {
  if (!tokens.length) return text
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return text.split(re).map((part, i) => (re.test(part) ? <mark key={i} className="rounded-sm bg-warn-100 px-0.5 text-inherit">{part}</mark> : <span key={i}>{part}</span>))
}

interface Option {
  symbol: string
  name: string | null
  sector: string
  hint?: string
  kind: 'match' | 'recent' | 'pick'
}

/**
 * Autocomplete for NSE symbols. Suggestions appear as you type (symbol prefix or any
 * word of the company name, multi-word allowed); before typing it offers recently
 * analysed symbols and today's picks. Arrow keys + Enter, Esc to close.
 */
export function StockSearch({
  to = (s) => `/analyst/${s}`,
  placeholder = 'Search symbol or company (e.g. TATA MOT, RELIANCE, HDFC)…',
  size = 'md',
  autoFocus = false,
  className,
}: {
  to?: (symbol: string) => string
  placeholder?: string
  size?: 'md' | 'lg'
  autoFocus?: boolean
  className?: string
}) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const { data: matches, isFetching } = useStockSearch(debounced)
  const { data: picks } = usePicks()

  useEffect(() => setRecent(loadRecent()), [])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const tokens = useMemo(() => debounced.split(/[\s,.\-&()]+/).filter(Boolean), [debounced])

  const options: Option[] = useMemo(() => {
    if (debounced) return (matches ?? []).map((m) => ({ symbol: m.symbol, name: m.name, sector: m.sector, hint: m.nifty500 ? 'Nifty 500' : undefined, kind: 'match' as const }))
    const rec: Option[] = recent.map((s) => ({ symbol: s, name: null, sector: '', kind: 'recent' as const }))
    const pk: Option[] = (picks?.picks ?? []).slice(0, 5).map((p) => ({ symbol: p.symbol, name: p.name, sector: p.sector, hint: `#${p.rank} today`, kind: 'pick' as const }))
    return [...rec, ...pk.filter((p) => !recent.includes(p.symbol))]
  }, [debounced, matches, recent, picks])

  useEffect(() => setActive(0), [options.length, debounced])

  const go = (symbol: string) => {
    rememberSymbol(symbol)
    setRecent(loadRecent())
    setOpen(false)
    setQ('')
    nav(to(symbol))
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(options.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = options[active] ?? options[0]
      if (pick) go(pick.symbol)
      else if (q.trim()) go(q.trim().toUpperCase())
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const h = size === 'lg' ? 'h-12 text-base pl-11' : 'h-9 text-sm pl-8'
  return (
    <div ref={ref} className={clsx('relative w-full', className)}>
      <Search size={size === 'lg' ? 18 : 15} className={clsx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400', size === 'lg' ? 'left-4' : 'left-2.5')} />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label="Search stocks"
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        className={clsx('w-full rounded-lg border border-ink-200 bg-white pr-3 placeholder:text-ink-400 focus:border-brand-500', h)}
      />
      <AnimatePresence>
        {open && (options.length > 0 || (debounced && !isFetching)) && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-40 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {!debounced && options.length > 0 && (
              <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{recent.length ? 'Recent & today’s picks' : 'Today’s picks'}</li>
            )}
            {options.map((o, i) => (
              <li key={`${o.kind}-${o.symbol}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(o.symbol)}
                  className={clsx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm', i === active ? 'bg-brand-50' : 'hover:bg-ink-50')}
                  role="option"
                  aria-selected={i === active}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {o.kind === 'recent' ? <Clock size={13} className="shrink-0 text-ink-400" /> : o.kind === 'pick' ? <TrendingUp size={13} className="shrink-0 text-up-600" /> : null}
                    <span className="font-semibold text-ink-900">{highlight(o.symbol, tokens)}</span>
                    {o.name && <span className="truncate text-ink-500">{highlight(o.name, tokens)}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-400">{o.hint ?? (o.sector && o.sector !== 'Unclassified' ? o.sector : '')}</span>
                </button>
              </li>
            ))}
            {debounced && !isFetching && options.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">No listed stock matches “{debounced}”. Try the NSE symbol or another word from the company name.</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
