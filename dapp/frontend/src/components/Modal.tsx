import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/cn'
import { CloseIcon } from './icons'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

// Lightweight centered dialog: scrim + Escape-to-close + scroll lock.
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps): React.JSX.Element | null => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') {
        return
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable === undefined || focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog so Tab is trapped and screen readers land here.
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable ?? dialogRef.current)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(8,8,18,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description === undefined ? undefined : descId}
            tabIndex={-1}
            className={cn(
              'relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-popover)]',
              className,
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg"
            >
              <CloseIcon width={16} height={16} />
            </button>
            <h2 id={titleId} className="pr-10 text-lg font-bold tracking-tight text-fg">
              {title}
            </h2>
            {description !== undefined && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
            <div className="mt-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
