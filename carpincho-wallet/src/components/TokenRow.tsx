import cantonIcon from '@/assets/canton.png'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { CHEVRON_RIGHT_ICON } from '@/components/ui/icons'

interface TokenRowProps {
  summary: TokenHoldingSummary
  onOpen: () => void
}

// Activity-style subtitle: UTXO count with pluralisation and an optional locked suffix.
const utxoSubtitle = (summary: TokenHoldingSummary): string => {
  const parts: string[] =
    summary.utxoCount === undefined
      ? ['UTXOs load on demand']
      : [`${summary.utxoCount} ${summary.utxoCount === 1 ? 'UTXO' : 'UTXOs'}`]
  if ((summary.lockedCount ?? 0) > 0) {
    parts.push(`${summary.lockedCount} locked`)
  }
  return parts.join(' · ')
}

// One token in the assets list; the whole row opens the token detail modal.
export const TokenRow = ({ summary, onOpen }: TokenRowProps): JSX.Element => (
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
    <span className="min-w-0">
      <span className="block truncate text-[0.94rem] font-semibold text-foreground">
        {summary.tokenLabel}
      </span>
      <span className="block truncate text-[0.84rem] text-muted-foreground">
        {utxoSubtitle(summary)}
      </span>
    </span>
    <span
      aria-hidden="true"
      className="justify-self-end text-muted-foreground"
    >
      {CHEVRON_RIGHT_ICON}
    </span>
  </button>
)
