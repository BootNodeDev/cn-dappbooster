import cantonIcon from '@/assets/canton.png'
import { formatTokenAmount } from '@/cip56/amount'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { LOCK_ICON } from '@/components/ui/icons'

interface TokenRowProps {
  summary: TokenHoldingSummary
  onOpen: () => void
}

// One token in the assets list: icon + name left, grouped balance right; opens the detail modal.
export const TokenRow = ({ summary, onOpen }: TokenRowProps): JSX.Element => {
  const hasLocked = (summary.lockedCount ?? 0) > 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-2.5 text-left outline-none transition-colors hover:bg-primary-soft/40 focus-visible:bg-primary-soft/60"
    >
      <img
        src={cantonIcon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-9 shrink-0 rounded-full"
      />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[0.94rem] font-semibold text-foreground">
          {summary.tokenLabel}
        </span>
        {hasLocked ? (
          <span
            role="img"
            className="shrink-0 text-warning"
            title="Some holdings are locked"
            aria-label="Some holdings are locked"
          >
            {LOCK_ICON}
          </span>
        ) : null}
      </span>
      <span className="justify-self-end font-mono text-[0.95rem] font-semibold text-foreground">
        {formatTokenAmount(summary.totalAmount)}
      </span>
    </button>
  )
}
