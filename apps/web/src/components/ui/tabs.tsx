import clsx from 'clsx'
import { motion, type HTMLMotionProps } from 'motion/react'
import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

interface TabsContextValue {
  value: string
  onValueChange: (val: string) => void
  layoutId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (val: string) => void
  children: ReactNode
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const activeValue = isControlled ? controlledValue : uncontrolledValue
  const [layoutId] = useState(() => `tab-pill-${Math.random().toString(36).slice(2, 8)}`)

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val)
    }
    onValueChange?.(val)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange, layoutId }}>
      <div className={clsx('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex items-center gap-1 rounded-xl border border-ink-200/70 bg-ink-100/60 p-1 backdrop-blur-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children: ReactNode
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled,
  ...props
}: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => ctx.onValueChange(value)}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40',
        isActive ? 'text-ink-900 font-semibold' : 'text-ink-500 hover:text-ink-800 hover:bg-white/40',
        className,
      )}
      {...props}
    >
      {isActive && (
        <motion.div
          layoutId={ctx.layoutId}
          transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
          className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-black/5"
          style={{ zIndex: 0 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  )
}

export interface TabsContentProps extends HTMLMotionProps<'div'> {
  value: string
  children: ReactNode
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabsContent must be used within Tabs')

  if (ctx.value !== value) return null

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className={clsx('mt-4 focus-visible:outline-none', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
