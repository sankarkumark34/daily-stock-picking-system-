import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface DropdownContextValue {
  isOpen: boolean
  setIsOpen: (val: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

export interface DropdownMenuProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const setIsOpen = (val: boolean) => {
    if (!isControlled) setUncontrolledOpen(val)
    onOpenChange?.(val)
  }

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownContext.Provider>
  )
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function DropdownMenuTrigger({ className, children, onClick, ...props }: DropdownMenuTriggerProps) {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownMenuTrigger must be used within DropdownMenu')

  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={ctx.isOpen}
      onClick={(e) => {
        onClick?.(e)
        ctx.setIsOpen(!ctx.isOpen)
      }}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-700 backdrop-blur-sm transition-all hover:bg-white hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 shadow-xs',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export function DropdownMenuContent({
  align = 'end',
  sideOffset = 6,
  className,
  children,
}: DropdownMenuContentProps) {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownMenuContent must be used within DropdownMenu')

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ctx.isOpen || !ctx.triggerRef.current) return

    const updatePosition = () => {
      const rect = ctx.triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      let left = rect.left
      if (align === 'end') {
        left = rect.right
      } else if (align === 'center') {
        left = rect.left + rect.width / 2
      }

      setCoords({
        top: rect.bottom + sideOffset,
        left,
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(e.target as Node)
      ) {
        ctx.setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ctx.setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ctx, align, sideOffset])

  return createPortal(
    <AnimatePresence>
      {ctx.isOpen && coords && (
        <motion.div
          ref={contentRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: align === 'end' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : 'none',
            zIndex: 9999,
          }}
          className={clsx(
            'min-w-[180px] rounded-xl border border-ink-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md ring-1 ring-black/5 focus:outline-none',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  danger?: boolean
}

export function DropdownMenuItem({
  icon,
  danger,
  className,
  children,
  onClick,
  disabled,
  ...props
}: DropdownMenuItemProps) {
  const ctx = useContext(DropdownContext)

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return
        onClick?.(e)
        ctx?.setIsOpen(false)
      }}
      className={clsx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-40',
        danger
          ? 'text-down-600 hover:bg-down-50 focus:bg-down-50'
          : 'text-ink-700 hover:bg-brand-50/80 hover:text-brand-900 focus:bg-brand-50/80 focus:text-brand-900',
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0 opacity-70">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  )
}

export function DropdownMenuSeparator({ className }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('-mx-1.5 my-1 h-px bg-ink-100', className)} role="separator" />
}
