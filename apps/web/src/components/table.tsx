import clsx from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { InfoTip } from './ui'

export type SortDir = 'asc' | 'desc'

export interface SortState {
  key: string | null
  dir: SortDir
  toggle: (key: string) => void
}

type Accessor<T> = (row: T, key: string) => unknown

function defaultAccessor<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function compare(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === ''
  const bn = b === null || b === undefined || b === ''
  if (an && bn) return 0
  if (an) return 1 // nulls last
  if (bn) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Sort + text-filter + named select filters for any array of rows.
 * `accessor` maps a column key to the value used for sorting; `searchText`
 * returns the text a row is matched against for the search box.
 */
export function useSortFilter<T>(
  rows: T[] | undefined,
  opts: {
    defaultKey?: string
    defaultDir?: SortDir
    accessor?: Accessor<T>
    searchText?: (row: T) => string
    /** named select filters: name → predicate builder for the chosen value */
    filters?: Record<string, (row: T, value: string) => boolean>
  } = {},
) {
  const [key, setKey] = useState<string | null>(opts.defaultKey ?? null)
  const [dir, setDir] = useState<SortDir>(opts.defaultDir ?? 'asc')
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const accessor = opts.accessor ?? defaultAccessor

  const toggle = (k: string) => {
    if (key === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setKey(k)
      setDir('asc')
    }
  }
  const setFilter = (name: string, value: string) => setFilterValues((f) => ({ ...f, [name]: value }))
  const clear = () => {
    setQuery('')
    setFilterValues({})
  }

  const out = useMemo(() => {
    let list = rows ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      const text = opts.searchText ?? ((r: T) => JSON.stringify(r))
      list = list.filter((r) => text(r).toLowerCase().includes(q))
    }
    for (const [name, value] of Object.entries(filterValues)) {
      const pred = opts.filters?.[name]
      if (value && pred) list = list.filter((r) => pred(r, value))
    }
    if (key) {
      list = [...list].sort((a, b) => {
        const c = compare(accessor(a, key), accessor(b, key))
        return dir === 'asc' ? c : -c
      })
    }
    return list
  }, [rows, query, filterValues, key, dir, accessor, opts.searchText, opts.filters])

  const active = !!query.trim() || Object.values(filterValues).some(Boolean)
  return { rows: out, sort: { key, dir, toggle } as SortState, query, setQuery, filterValues, setFilter, clear, active, total: rows?.length ?? 0 }
}

/** Clickable, sortable table header cell with optional glossary tooltip. */
export function SortTh({ k, sort, children, className, align = 'left', tip }: { k: string; sort: SortState; children: ReactNode; className?: string; align?: 'left' | 'right'; tip?: string }) {
  const active = sort.key === k
  return (
    <th className={clsx(align === 'right' && 'text-right', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => sort.toggle(k)}
        className={clsx('inline-flex items-center gap-1 uppercase tracking-wide hover:text-brand-700', active ? 'text-brand-700' : 'text-ink-500', align === 'right' && 'flex-row-reverse')}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {tip && <InfoTip term={tip} />}
        </span>
        {active ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  )
}

/** Search box + optional select filters + result count, placed above a table. */
export function TableToolbar({
  query,
  onQuery,
  count,
  total,
  onClear,
  active,
  placeholder = 'Filter rows…',
  children,
  className,
}: {
  query: string
  onQuery: (q: string) => void
  count: number
  total: number
  onClear?: () => void
  active?: boolean
  placeholder?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-2.5', className)}>
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Filter table"
          className="h-8 w-56 rounded-lg border border-ink-200 bg-white pl-7 pr-2 text-xs placeholder:text-ink-400 focus:border-brand-500"
        />
      </div>
      {children}
      <span className="ml-auto text-[11px] text-ink-500">
        {count === total ? `${total} rows` : `${count} of ${total} rows`}
      </span>
      {active && onClear && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-100">
          <X size={12} /> Clear
        </button>
      )}
    </div>
  )
}

/** Compact select used inside TableToolbar. */
export function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs text-ink-700 focus:border-brand-500">
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
