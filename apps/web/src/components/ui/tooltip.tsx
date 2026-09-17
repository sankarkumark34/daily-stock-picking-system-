import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  delay?: number
}

export function Tooltip({ content, children, side = 'top', delay = 150, className }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setCoords({
        top: side === 'top' ? rect.top - 6 : rect.bottom + 6,
        left: rect.left + rect.width / 2,
      })
      setIsOpen(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx('inline-flex items-center', className)}
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {isOpen && coords && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: side === 'top' ? 2 : -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                zIndex: 10000,
              }}
              className="pointer-events-none rounded-md border border-ink-200/80 bg-ink-900/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-nowrap"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
