import { cn } from '@/utils/cn.ts'

export type ConnectionTone = 'good' | 'warn' | 'muted'

interface ConnectionFooterProps {
  tone: ConnectionTone
  label: string
  onEdit: () => void
}

const DOT_CLASS: Record<ConnectionTone, string> = {
  good: 'bg-success',
  warn: 'bg-warning',
  muted: 'bg-muted-foreground/60',
}

export const ConnectionFooter = ({ tone, label, onEdit }: ConnectionFooterProps): JSX.Element => (
  <button
    type="button"
    onClick={onEdit}
    aria-label={`Edit connection: ${label}`}
    className={cn(
      'fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-popup',
      'flex items-center gap-2 px-4 py-2.5 border-t border-border bg-surface/95 backdrop-blur-md',
      'text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:shadow-focus',
    )}
  >
    <span
      aria-hidden="true"
      className={cn('size-2 rounded-full shrink-0', DOT_CLASS[tone])}
    />
    <span className="flex-1 min-w-0 truncate">
      <span className="font-mono text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        connection:
      </span>
      <span className="ml-2 font-sans text-[0.86rem] font-medium text-foreground">{label}</span>
    </span>
    <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
      edit
    </span>
  </button>
)
