import { cn } from '@/lib/cn'
import { formatCC, sanitizeAmountInput } from '@/lib/format'
import { CcCoin } from './CcCoin'

interface TokenAmountFieldProps {
  value: string
  onChange: (value: string) => void
  balance?: number
  error?: string
}

// Uniswap/1inch-style amount input: large number on the left, the CC token mark on
// the right, and a balance + Max affordance below. Single-token, so no picker.
export const TokenAmountField = ({
  value,
  onChange,
  balance,
  error,
}: TokenAmountFieldProps): React.JSX.Element => {
  const noBalance = balance === undefined || balance <= 0
  return (
    <div>
      <div
        className={cn(
          'rounded-2xl border bg-bg p-4 transition-colors',
          error !== undefined ? 'border-danger/50' : 'border-border focus-within:border-primary',
        )}
      >
        <div className="flex items-center gap-3">
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
            placeholder="0"
            aria-label="Amount"
            className="min-w-0 flex-1 bg-transparent font-mono text-3xl font-semibold text-fg outline-none placeholder:text-fg-soft"
          />
          <CcCoin className="size-8 shrink-0" />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-fg-muted">
          <span>Balance: {balance === undefined ? '…' : formatCC(balance)}</span>
          <button
            type="button"
            disabled={noBalance}
            onClick={() => balance !== undefined && onChange(String(balance))}
            className={cn(
              'font-bold transition-colors',
              noBalance ? 'text-fg-soft' : 'text-primary hover:text-primary-hover',
            )}
          >
            Max
          </button>
        </div>
      </div>
      {error !== undefined && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
