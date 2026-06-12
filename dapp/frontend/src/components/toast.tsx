import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'
import { CheckIcon, CloseIcon, CopyIcon } from './icons'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (tone: ToastTone, message: string) => void
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID().slice(0, 8), tone, message }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string): void => useToastStore.getState().push('success', message),
  error: (message: string): void => useToastStore.getState().push('error', message),
  info: (message: string): void => useToastStore.getState().push('info', message),
}

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent',
}

// Errors can be long (raw ledger rejections), so they get a scrollable body, a copy
// button, and no auto-dismiss; success/info stay as click-to-dismiss pills.
const ErrorToast = ({ item }: { item: ToastItem }): React.JSX.Element => {
  const dismiss = useToastStore((s) => s.dismiss)
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(item.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable; nothing to do
    }
  }
  return (
    <div
      className={cn(
        'pointer-events-auto w-full rounded-xl border bg-surface shadow-[var(--shadow-popover)]',
        toneStyles.error,
      )}
    >
      <div className="flex items-start gap-1.5 p-2.5">
        <div className="max-h-40 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fg">
          {item.message}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            type="button"
            aria-label="Copy error"
            title="Copy error"
            onClick={() => void copy()}
            className="text-fg-muted transition-colors hover:text-fg"
          >
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => dismiss(item.id)}
            className="text-fg-muted transition-colors hover:text-fg"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

const ToastRow = ({ item }: { item: ToastItem }): React.JSX.Element => {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    if (item.tone === 'error') {
      return
    }
    const timer = setTimeout(() => dismiss(item.id), 3200)
    return () => clearTimeout(timer)
  }, [item.id, item.tone, dismiss])

  if (item.tone === 'error') {
    return <ErrorToast item={item} />
  }
  return (
    <button
      type="button"
      onClick={() => dismiss(item.id)}
      className={cn(
        'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[item.tone],
      )}
    >
      {item.tone === 'success' && <CheckIcon width={16} height={16} />}
      <span className="text-fg">{item.message}</span>
    </button>
  )
}

export const Toaster = (): React.JSX.Element => {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-80 flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ToastRow item={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
