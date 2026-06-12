import { formatTokenAmount } from '@/cip56/amount'
import { cn } from '@/utils/cn'

export interface AmountFieldProps {
  value: string
  onChange: (value: string) => void
  onMax: () => void
  balance: string
  tokenLabel: string
  error?: boolean
}

const FIELD_CLASS =
  'flex items-center gap-2 rounded-md border bg-surface px-4 py-2.5 transition-colors ' +
  'focus-within:shadow-focus'

export const AmountField = ({
  value,
  onChange,
  onMax,
  balance,
  tokenLabel,
  error,
}: AmountFieldProps): JSX.Element => (
  <div className="grid gap-1">
    <span className="text-[0.78rem] font-semibold text-muted-foreground">Amount</span>
    <div
      className={cn(
        FIELD_CLASS,
        error
          ? 'border-danger focus-within:border-danger'
          : 'border-border-strong focus-within:border-primary',
      )}
    >
      <input
        aria-label="Amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-form-placeholder"
      />
      <button
        type="button"
        onClick={onMax}
        className="shrink-0 rounded-sm px-2 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:shadow-focus"
      >
        Max
      </button>
    </div>
    <span className="text-[0.72rem] text-muted-foreground">
      Balance: {formatTokenAmount(balance)} {tokenLabel}
    </span>
  </div>
)
