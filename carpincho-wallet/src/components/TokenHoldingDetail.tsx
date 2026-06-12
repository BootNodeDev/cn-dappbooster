import type { TokenHolding } from '@/cip56/holdings'
import { transferTimeLabel } from '@/cip56/transfers'

interface HoldingDetailRowProps {
  label: string
  value: string
}

// Keeps raw holding values readable in the per-UTXO detail view.
const HoldingDetailRow = ({ label, value }: HoldingDetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)

// Full detail for a single token holding UTXO.
export const TokenHoldingDetail = ({ holding }: { holding: TokenHolding }): JSX.Element => {
  const view = holding.interfaceViewValue
  const lock = view?.lock
  return (
    <dl className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <HoldingDetailRow
        label="amount"
        value={view?.amount ?? 'unknown'}
      />
      <HoldingDetailRow
        label="lock"
        value={lock == null ? 'unlocked' : 'locked'}
      />
      {lock?.expiresAt === undefined ? null : (
        <HoldingDetailRow
          label="expires"
          value={transferTimeLabel(lock.expiresAt)}
        />
      )}
      <HoldingDetailRow
        label="contract id"
        value={holding.contractId}
      />
    </dl>
  )
}
