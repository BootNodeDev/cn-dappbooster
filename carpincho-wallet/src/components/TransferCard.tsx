import cantonIcon from '@/assets/canton.png'
import { formatTokenAmount } from '@/cip56/amount'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { tokenDisplayLabel, transferDescription } from '@/cip56/transfers'
import { PrimaryButton } from '@/components/ui/Button'
import { EYE_ICON } from '@/components/ui/icons'
import { shortMiddle } from '@/utils/account'

interface TransferCardProps {
  transfer: PendingTokenTransfer
  direction: 'incoming' | 'outgoing'
  // Acceptance only applies to incoming transfers; senders just watch theirs settle.
  onAccept?: (transferInstructionCid: string) => void | Promise<void>
  onOpenDetails: (transfer: PendingTokenTransfer) => void
}

const EYE_BUTTON_CLASS =
  'grid size-8 shrink-0 place-items-center rounded-md text-soft outline-none transition-colors hover:text-foreground focus-visible:shadow-focus [&_svg]:size-4'

// One active transfer instruction. Incoming = accent needs-action card with Accept;
// outgoing = quiet watch-only row with a Pending pill. Both open details in a Sheet.
export const TransferCard = ({
  transfer,
  direction,
  onAccept,
  onOpenDetails,
}: TransferCardProps): JSX.Element => {
  const view = transfer.interfaceViewValue?.transfer
  const label = `${
    view?.amount === undefined ? 'unknown' : formatTokenAmount(view.amount)
  } ${tokenDisplayLabel(view?.instrumentId)}`
  const description = transferDescription(transfer)
  const counterpartyLabel = direction === 'incoming' ? 'from' : 'to'
  const counterparty = direction === 'incoming' ? view?.sender : view?.receiver
  const counterpartyText = counterparty === undefined ? 'unknown' : shortMiddle(counterparty, 10, 6)

  // Token icon sits before the amount so the row reads like the assets list.
  const amountRow = (
    <p className="m-0 flex items-center gap-2 text-[0.95rem] font-semibold text-foreground">
      <img
        src={cantonIcon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-5 shrink-0 rounded-full"
      />
      {label}
    </p>
  )

  const detailsButton = (
    <button
      type="button"
      aria-label="Transfer details"
      className={EYE_BUTTON_CLASS}
      onClick={() => onOpenDetails(transfer)}
    >
      {EYE_ICON}
    </button>
  )

  if (direction === 'outgoing') {
    return (
      <article
        aria-label="Outgoing transfer, awaiting acceptance"
        className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-3"
      >
        <div className="min-w-0 flex-1">
          {amountRow}
          <p className="m-0 mt-1 font-mono text-[0.76rem] text-muted-foreground">
            {counterpartyLabel}: {counterpartyText}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-1 text-[0.72rem] font-semibold text-warning">
          Pending
        </span>
        {detailsButton}
      </article>
    )
  }

  return (
    <article
      aria-label="Incoming transfer"
      className="relative overflow-hidden rounded-md border border-accent/45 bg-gradient-to-b from-accent/15 to-accent/[0.06] py-3 pr-3 pl-4"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-accent to-primary"
      />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {amountRow}
          {description === undefined ? null : (
            <p className="m-0 mt-1 text-[0.83rem] leading-5 text-foreground">{description}</p>
          )}
          <p className="m-0 mt-1 font-mono text-[0.76rem] text-muted-foreground">
            {counterpartyLabel}: {counterpartyText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PrimaryButton
            className="px-3 py-1.5 text-[0.82rem]"
            onClick={() => {
              void onAccept?.(transfer.contractId)
            }}
          >
            Accept
          </PrimaryButton>
          {detailsButton}
        </div>
      </div>
    </article>
  )
}
