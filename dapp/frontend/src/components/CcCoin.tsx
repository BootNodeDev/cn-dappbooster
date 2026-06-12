import { cn } from '@/lib/cn'

// Canton Coin token mark (official logo from CoinGecko, vendored at /public/cc.png).
export const CcCoin = ({ className }: { className?: string }): React.JSX.Element => (
  <img
    src="/cc.png"
    alt="Canton Coin"
    className={cn('inline-block shrink-0 object-contain', className)}
  />
)
