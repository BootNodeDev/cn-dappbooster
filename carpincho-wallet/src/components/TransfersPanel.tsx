import { useEffect, useState } from 'react'
import {
  tokenDisplayLabel,
  transferDescription,
  transferStatusLabel,
  transferTimeLabel,
} from '@/cip56/transfers'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import { useAmuletPreapproval } from '@/hooks/useAmuletPreapproval'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { usePendingCip56Transfers } from '@/hooks/usePendingCip56Transfers'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface TransfersPanelProps {
  account?: AccountPublic
  api?: Cip56TransferApi
  preapprovalApi?: AmuletPreapprovalApi
  onPendingCountChange?: (count: number) => void
}

interface TransferDetailRowProps {
  label: string
  value: string
}

interface AmuletPreapprovalSectionProps {
  account: AccountPublic
  api?: AmuletPreapprovalApi
}

const AUTO_ACCEPT_TOOLTIP =
  "When this is on, any Amulet someone sends you drops straight into your wallet. Turn it off and you'll have to accept each incoming transfer yourself."

// Lets the receiver opt into Amulet auto-accept without routing signing through wallet-service.
const AmuletPreapprovalSection = ({ account, api }: AmuletPreapprovalSectionProps): JSX.Element => {
  const vault = useVault()
  const preapproval = useAmuletPreapproval(account, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })
  const status = preapproval.status
  const isExpired = status?.expired === true
  const isActive = status?.active === true && !isExpired
  const confirmed = isActive || isExpired

  // Optimistic: hold the requested state until polling confirms it; the ledger can lag.
  const [optimistic, setOptimistic] = useState<boolean | undefined>(undefined)
  const checked = optimistic ?? confirmed

  useEffect(() => {
    if (optimistic !== undefined && optimistic === confirmed) {
      setOptimistic(undefined)
    }
  }, [optimistic, confirmed])

  const handleToggle = async (): Promise<void> => {
    const next = !checked
    setOptimistic(next)
    try {
      if (next) {
        await preapproval.enable()
        toast.success('Amulet auto-accept enabled')
      } else {
        await preapproval.disable()
        toast.success('Amulet auto-accept disabled')
      }
    } catch (error) {
      setOptimistic(undefined)
      toast.error(error instanceof Error ? error.message : 'Amulet auto-accept failed')
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-1 pb-3">
      <div className="flex items-center gap-1.5">
        <h2 className="m-0 text-[0.95rem] font-semibold text-foreground">Auto-accept</h2>
        <Tooltip content={AUTO_ACCEPT_TOOLTIP} />
      </div>
      <Switch
        aria-label="Auto-accept"
        checked={checked}
        disabled={preapproval.busy || (preapproval.loading && status === undefined)}
        onCheckedChange={() => {
          void handleToggle()
        }}
      />
    </div>
  )
}

// Keeps long Canton identifiers readable without hiding the full value in the details area.
const TransferDetailRow = ({ label, value }: TransferDetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)

// Renders incoming CIP-56 transfer instructions that require receiver acceptance.
export const TransfersPanel = ({
  account,
  api,
  preapprovalApi,
  onPendingCountChange,
}: TransfersPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [acceptingCid, setAcceptingCid] = useState<string | undefined>(undefined)
  const [expandedCid, setExpandedCid] = useState<string | undefined>(undefined)
  const { transfers, loading, error, accept } = usePendingCip56Transfers(activeAccount, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })

  // Exposes the pending count to any parent that wants to surface action badges.
  useEffect(() => {
    onPendingCountChange?.(transfers.length)
  }, [onPendingCountChange, transfers.length])

  useEffect(() => {
    return () => onPendingCountChange?.(0)
  }, [onPendingCountChange])

  // Tracks one open transfer details section at a time to keep the transfers list compact.
  const toggleDetails = (transferInstructionCid: string): void => {
    setExpandedCid((current) =>
      current === transferInstructionCid ? undefined : transferInstructionCid,
    )
  }

  // Runs the receiver-acceptance flow while keeping the button state scoped to one transfer.
  const onAccept = async (transferInstructionCid: string): Promise<void> => {
    setAcceptingCid(transferInstructionCid)
    try {
      await accept(transferInstructionCid)
      toast.success('Transfer accepted.')
    } catch (err) {
      toast.error(`Accept failed: ${(err as Error).message}`)
    } finally {
      setAcceptingCid(undefined)
    }
  }

  if (activeAccount === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No account selected</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-1 pt-4 pb-2">
      <AmuletPreapprovalSection
        account={activeAccount}
        api={preapprovalApi}
      />

      <h2 className="m-0 px-1 text-[0.95rem] font-semibold text-foreground">Incoming transfers</h2>

      {error === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      )}

      {transfers.length === 0 && !loading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">
            No pending transfers
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {transfers.map((transfer) => {
            const transferView = transfer.interfaceViewValue?.transfer
            const label = `${transferView?.amount ?? 'unknown'} ${tokenDisplayLabel(
              transferView?.instrumentId,
            )}`
            const description = transferDescription(transfer)
            const isAccepting = acceptingCid === transfer.contractId
            const isExpanded = expandedCid === transfer.contractId
            const detailsId = `transfer-details-${transfer.contractId}`
            return (
              <article
                key={transfer.contractId}
                className="rounded-md border border-border bg-surface px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.95rem] font-semibold text-foreground">{label}</p>
                    {description === undefined ? null : (
                      <p className="m-0 mt-1 text-[0.83rem] leading-5 text-foreground">
                        {description}
                      </p>
                    )}
                    <p className="m-0 mt-1 font-mono text-[0.76rem] text-muted-foreground">
                      from:{' '}
                      {transferView?.sender === undefined
                        ? 'unknown'
                        : shortMiddle(transferView.sender, 10, 6)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <PrimaryButton
                      className="px-3 py-1.5 text-[0.82rem]"
                      disabled={isAccepting}
                      onClick={() => {
                        void onAccept(transfer.contractId)
                      }}
                    >
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </PrimaryButton>
                    <SecondaryButton
                      aria-controls={detailsId}
                      aria-expanded={isExpanded}
                      className="px-3 py-1.5 text-[0.78rem]"
                      onClick={() => toggleDetails(transfer.contractId)}
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </SecondaryButton>
                  </div>
                </div>
                {isExpanded ? (
                  <dl
                    id={detailsId}
                    className="mt-3 grid gap-3 rounded-md border border-border bg-background/60 p-3"
                  >
                    <TransferDetailRow
                      label="status"
                      value={transferStatusLabel(transfer)}
                    />
                    <TransferDetailRow
                      label="requested"
                      value={transferTimeLabel(transferView?.requestedAt)}
                    />
                    <TransferDetailRow
                      label="expires"
                      value={transferTimeLabel(transferView?.executeBefore)}
                    />
                    <TransferDetailRow
                      label="sender"
                      value={transferView?.sender ?? 'unknown'}
                    />
                    <TransferDetailRow
                      label="receiver"
                      value={transferView?.receiver ?? 'unknown'}
                    />
                    <TransferDetailRow
                      label="contract id"
                      value={transfer.contractId}
                    />
                  </dl>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
