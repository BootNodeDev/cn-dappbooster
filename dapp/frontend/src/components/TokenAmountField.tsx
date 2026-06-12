import { cn } from '@/lib/cn'
import { CcCoin } from './CcCoin'

interface TokenAmountFieldProps {
  value: string
  onChange: (value: string) => void
  balance?: number
  error?: string
}

// Uniswap/1inch-style amount input: large number on the left, a token pill on the
// right, and a balance + Max affordance below. Single-token, so the pill is static.
export const TokenAmountField = ({
  value,
  onChange,
  balance,
  error,
}: TokenAmountFieldProps): React.JSX.Element => (
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
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          aria-label="Amount"
          className="min-w-0 flex-1 bg-transparent font-mono text-3xl font-semibold text-fg outline-none placeholder:text-fg-soft"
        />
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3.5">
          <CcCoin className="size-7" />
          <span className="text-sm font-bold text-fg">CC</span>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-fg-muted">
        <span>
          Balance:{' '}
          {balance === undefined
            ? '…'
            : balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
        {balance !== undefined && balance > 0 && (
          <button
            type="button"
            onClick={() => onChange(String(balance))}
            className="font-bold text-primary transition-colors hover:text-primary-hover"
          >
            Max
          </button>
        )}
      </div>
    </div>
    {error !== undefined && <p className="mt-1 text-xs text-danger">{error}</p>}
  </div>
)
