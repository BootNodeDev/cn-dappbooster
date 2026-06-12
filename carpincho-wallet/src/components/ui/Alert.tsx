import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type FeedbackVariant = 'info' | 'error' | 'warning' | 'success'

export const FEEDBACK_BASE_CLASS =
  'relative pl-4 pr-3.5 py-3 rounded-md text-[1rem] leading-relaxed font-medium border-l-[3px]'

export const FEEDBACK_VARIANT_CLASS: Record<FeedbackVariant, string> = {
  info: 'text-primary-ink bg-primary-soft border-primary',
  error: 'text-danger bg-danger-soft border-danger',
  warning: 'text-warning bg-warning-soft border-warning',
  success: 'text-success bg-success-soft border-success',
}

interface AlertProps {
  variant: FeedbackVariant
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
  children: ReactNode
}

const BASE_CLASS = cn(FEEDBACK_BASE_CLASS, 'animate-slide-down-and-fade')

export const Alert = ({
  variant,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
}: AlertProps): React.JSX.Element => {
  const base = cn(
    BASE_CLASS,
    FEEDBACK_VARIANT_CLASS[variant],
    onDismiss !== undefined && 'flex items-center justify-between gap-3',
    className,
  )
  if (onDismiss === undefined) {
    return <div className={base}>{children}</div>
  }
  return (
    <div className={base}>
      <span className="min-w-0">{children}</span>
      <button
        type="button"
        className="shrink-0 border-0 bg-transparent text-current font-semibold text-[0.82rem] uppercase tracking-wider p-0 hover:underline"
        onClick={onDismiss}
      >
        {dismissLabel}
      </button>
    </div>
  )
}
