import clsx from 'clsx'
import { X } from 'lucide-react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface DialogContextValue {
  isOpen: boolean
  setIsOpen: (val: boolean) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

export interface DialogProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const setIsOpen = (val: boolean) => {
    if (!isControlled) setUncontrolledOpen(val)
    onOpenChange?.(val)
  }

  return <DialogContext.Provider value={{ isOpen, setIsOpen }}>{children}</DialogContext.Provider>
}

export interface DialogTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function DialogTrigger({ className, children, onClick, ...props }: DialogTriggerProps) {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('DialogTrigger must be used within Dialog')

  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e)
        ctx.setIsOpen(true)
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

export interface DialogContentProps extends HTMLMotionProps<'div'> {
  children: ReactNode
}

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('DialogContent must be used within Dialog')

  useEffect(() => {
    if (!ctx.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ctx.setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [ctx.isOpen, ctx])

  return createPortal(
    <AnimatePresence>
      {ctx.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => ctx.setIsOpen(false)}
            className="fixed inset-0 bg-ink-900/30 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
            className={clsx(
              'relative z-10 w-full max-w-lg rounded-2xl border border-ink-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-black/5',
              className,
            )}
            {...props}
          >
            <button
              type="button"
              onClick={() => ctx.setIsOpen(false)}
              className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors focus:outline-none"
              aria-label="Close"
            >
              <X size={15} />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function DialogHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex flex-col space-y-1.5 text-left mb-4', className)} {...props}>{children}</div>
}

export function DialogTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx('text-base font-semibold leading-none tracking-tight text-ink-900', className)} {...props}>{children}</h2>
}

export function DialogDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx('text-xs text-ink-500', className)} {...props}>{children}</p>
}

export function DialogFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('mt-5 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2', className)} {...props}>{children}</div>
}
