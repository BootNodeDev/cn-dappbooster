import type { PendingTokenTransfer } from '@/cip56/transfers'
import { transferStatusLabel, transferTimeLabel } from '@/cip56/transfers'
import { Sheet } from '@/components/ui/Sheet'

interface TransferDetailRowProps {
  label: string
  value: string
}

// Keeps long Canton identifiers readable inside the details sheet.
const TransferDetailRow = ({ label, value }: TransferDetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)

interface TransferDetailsSheetProps {
  transfer: PendingTokenTransfer | null
  onClose: () => void
}

// Full transfer metadata in the app's standard Sheet, opened from a transfer's eye button.
export const TransferDetailsSheet = ({
  transfer,
  onClose,
}: TransferDetailsSheetProps): JSX.Element => {
  const view = transfer?.interfaceViewValue?.transfer
  return (
    <Sheet
      open={transfer !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      side="center"
      title="Transfer details"
      description="Full details for this transfer instruction."
    >
      {transfer === null ? null : (
        <dl className="grid gap-3">
          <TransferDetailRow
            label="status"
            value={transferStatusLabel(transfer)}
          />
          <TransferDetailRow
            label="requested"
            value={transferTimeLabel(view?.requestedAt)}
          />
          <TransferDetailRow
            label="expires"
            value={transferTimeLabel(view?.executeBefore)}
          />
          <TransferDetailRow
            label="sender"
            value={view?.sender ?? 'unknown'}
          />
          <TransferDetailRow
            label="receiver"
            value={view?.receiver ?? 'unknown'}
          />
          <TransferDetailRow
            label="contract id"
            value={transfer.contractId}
          />
        </dl>
      )}
    </Sheet>
  )
}
