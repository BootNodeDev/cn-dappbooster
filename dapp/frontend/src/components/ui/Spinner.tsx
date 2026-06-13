import { cn } from '@/utils/cn'

// Accessible loading spinner. `tone` picks the ring color against its background.
export const Spinner = ({
  size = 'md',
  tone = 'foreground',
  label = 'Loading',
}: {
  size?: 'sm' | 'md'
  tone?: 'foreground' | 'background' | 'primary'
  label?: string
}): JSX.Element => {
  const ring = {
    foreground: 'border-foreground/30 border-t-foreground',
    background: 'border-background/30 border-t-background',
    primary: 'border-primary-foreground/30 border-t-primary-foreground',
  }[tone]
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-2',
        size === 'sm' ? 'size-3.5' : 'size-4',
        ring,
      )}
    />
  )
}
