import { cn } from '@/lib/cn'

// Canton Coin token mark: a brand-gradient coin with the CC glyph, for token pills.
export const CcCoin = ({ className }: { className?: string }): React.JSX.Element => (
  <span
    className={cn(
      'inline-grid shrink-0 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-white',
      className,
    )}
  >
    <span className="font-mono text-[0.6rem] font-bold leading-none tracking-tight">CC</span>
  </span>
)
