import clsx from 'clsx'
import { Info } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import type { Tone } from '../lib/format'
import { GLOSSARY } from '../lib/glossary'

/* ---------- motion presets ---------- */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
}
export const staggerList = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } }

/* ---------- primitives ---------- */
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={clsx('rounded-xl glass-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5')}>{children}</div>
    </section>
  )
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-up-50 text-up-700 ring-up-100',
  danger: 'bg-down-50 text-down-700 ring-down-100',
  warning: 'bg-warn-50 text-warn-700 ring-warn-100',
  info: 'bg-brand-50 text-brand-700 ring-brand-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export function Badge({ tone = 'neutral', children, size = 'sm', className }: { tone?: Tone; children: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const toneText: Record<Tone, string> = {
  neutral: 'text-ink-900',
  success: 'text-up-700',
  danger: 'text-down-700',
  warning: 'text-warn-700',
  info: 'text-brand-700',
  violet: 'text-violet-600',
}

/* ---------- glossary tooltip ---------- */
/**
 * Small (i) icon; hover or focus shows a plain-language explanation from the glossary.
 * Pass `term` (glossary key) or a custom `title`/`text`.
 */
export function InfoTip({ term, title, text, read, className }: { term?: string; title?: string; text?: string; read?: string; className?: string }) {
  const entry = term ? GLOSSARY[term] : undefined
  const t = title ?? entry?.title
  const simple = entry?.simple
  const body = text ?? entry?.technical
  const how = read ?? entry?.read
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  if (!body) return null
  const show = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const above = r.bottom + 180 > window.innerHeight
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160), y: above ? r.top - 6 : r.bottom + 6, above })
  }
  const hide = () => setPos(null)
  return (
    <span className={clsx('inline-flex align-middle', className)}>
      <button
        ref={btn}
        type="button"
        aria-label={`What is ${t ?? 'this'}?`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 hover:text-brand-600 focus:text-brand-600"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation()
          pos ? hide() : show()
        }}
      >
        <Info size={13} />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: pos.x, top: pos.y, transform: pos.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
            className="pointer-events-none fixed z-[1000] w-80 rounded-lg border border-ink-200 bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-700 shadow-xl"
          >
            {t && <span className="mb-1.5 block text-[13px] font-semibold text-ink-900">{t}</span>}
            {simple && (
              <span className="mb-2 block rounded-md bg-brand-50 px-2 py-1.5 text-[12px] leading-relaxed text-brand-700">
                <span className="font-semibold">In simple words: </span>
                {simple}
              </span>
            )}
            <span className="block text-ink-600">
              {simple && <span className="font-semibold text-ink-700">Technically: </span>}
              {body}
            </span>
            {how && (
              <span className="mt-2 block border-t border-ink-100 pt-2 text-ink-700">
                <span className="font-semibold">How to read it: </span>
                {how}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  )
}

/** Label followed by an (i) tooltip for the given glossary term. */
export function Term({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      {children}
      <InfoTip term={k} />
    </span>
  )
}

export function StatTile({ label, value, sub, tone = 'neutral', icon, className, tip }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode; className?: string; tip?: string }) {
  return (
    <motion.div variants={fadeUp} className={clsx('rounded-xl border border-ink-200 bg-white p-4 shadow-card', className)}>
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {label}
          {tip && <InfoTip term={tip} />}
        </p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <p className={clsx('mt-1.5 text-2xl font-semibold tnum', toneText[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </motion.div>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200',
    secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 disabled:text-ink-400',
    ghost: 'text-ink-700 hover:bg-ink-100 disabled:text-ink-400',
    danger: 'bg-down-600 text-white hover:bg-down-700 disabled:bg-down-100',
  }[variant]
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        v,
        className,
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx('h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500', className)}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-900 focus:border-brand-500', className)} {...rest}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-500">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onChange(!checked)}
        className={clsx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-ink-200')}
      >
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
      </span>
      {label}
    </label>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-ink-100', className)} />
}

export function ProgressBar({ value, tone = 'info', className }: { value: number; tone?: Tone; className?: string }) {
  const bar = { neutral: 'bg-ink-400', success: 'bg-up-600', danger: 'bg-down-600', warning: 'bg-warn-600', info: 'bg-brand-500', violet: 'bg-violet-600' }[tone]
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={clsx('h-full rounded-full', bar)} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const c = {
    neutral: 'border-ink-200 bg-ink-50 text-ink-700',
    success: 'border-up-100 bg-up-50 text-up-700',
    danger: 'border-down-100 bg-down-50 text-down-700',
    warning: 'border-warn-100 bg-warn-50 text-warn-700',
    info: 'border-brand-100 bg-brand-50 text-brand-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-600',
  }[tone]
  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-sm leading-relaxed', c)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

export function FactorBar({ label, raw, weight, note, tip }: { label: string; raw: number; weight: number; note?: string; tip?: string }) {
  const tone: Tone = raw >= 70 ? 'success' : raw >= 50 ? 'info' : raw >= 35 ? 'warning' : 'danger'
  return (
    <div className="grid grid-cols-[150px_1fr_64px] items-center gap-3 text-xs">
      <div>
        <p className="inline-flex items-center gap-1 font-medium text-ink-900">
          {label}
          {tip && <InfoTip term={tip} />}
        </p>
        <p className="text-[11px] text-ink-500">weight {weight}</p>
      </div>
      <div title={note}>
        <ProgressBar value={raw} tone={tone} />
        {note && <p className="mt-1 truncate text-[11px] text-ink-500">{note}</p>}
      </div>
      <p className="num text-ink-900">{raw.toFixed(0)}<span className="text-ink-400">/100</span></p>
    </div>
  )
}

export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1.5 text-sm last:border-b-0">
      <span className="text-ink-500">{k}</span>
      <span className={clsx('font-medium text-ink-900', mono && 'tnum font-mono text-[13px]')}>{v}</span>
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return <Callout tone="danger">{msg}</Callout>
}

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-8 w-8 border-3' }[size]
  return (
    <div className={clsx('animate-spin rounded-full border-current border-t-transparent text-ink-400', sz, className)} role="status" aria-label="Loading" />
  )
}

