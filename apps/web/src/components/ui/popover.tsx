import clsx from 'clsx'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface PopoverContextValue {
  isOpen: boolean
  setIsOpen: (val: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

export interface PopoverProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const setIsOpen = (val: boolean) => {
    if (!isControlled) setUncontrolledOpen(val)
    onOpenChange?.(val)
  }

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  )
}

export interface PopoverTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function PopoverTrigger({ className, children, onClick, ...props }: PopoverTriggerProps) {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('PopoverTrigger must be used within Popover')

  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      aria-expanded={ctx.isOpen}
      onClick={(e) => {
        onClick?.(e)
        ctx.setIsOpen(!ctx.isOpen)
      }}
      className={clsx('inline-flex items-center gap-1.5 focus-visible:outline-none', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export interface PopoverContentProps extends HTMLMotionProps<'div'> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export function PopoverContent({
  align = 'center',
  sideOffset = 8,
  className,
  children,
  ...props
}: PopoverContentProps) {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('PopoverContent must be used within Popover')

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
            'w-72 rounded-2xl border border-ink-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5 focus:outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
