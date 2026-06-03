import { cn } from '@/utils/cn'

interface StatusDotProps {
  active: boolean
}

// Mirrors the connection-footer dot: a solid coloured circle whose colour encodes state. Here the
// state is whether this account is the active one (success/green) versus inactive (muted neutral).
export const StatusDot = ({ active }: StatusDotProps): JSX.Element => (
  <span
    aria-hidden="true"
    data-testid="account-status-dot"
    data-active={active ? true : undefined}
    className={cn('size-2 shrink-0 rounded-full', active ? 'bg-success' : 'bg-muted-foreground/30')}
  />
)
