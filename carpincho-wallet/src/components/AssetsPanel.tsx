import { useState } from 'react'
import { tokenDisplayLabel } from '@/cip56/transfers'
import { PrimaryButton } from '@/components/ui/Button'
import { toast } from '@/components/ui/toast'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { usePendingCip56Transfers } from '@/hooks/usePendingCip56Transfers'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface AssetsPanelProps {
  account?: AccountPublic
  api?: Cip56TransferApi
}

// Renders incoming CIP-56 transfer instructions that require receiver acceptance.
export const AssetsPanel = ({ account, api }: AssetsPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [acceptingCid, setAcceptingCid] = useState<string | undefined>(undefined)
  const { transfers, loading, error, accept } = usePendingCip56Transfers(activeAccount, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })

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
    <div className="flex min-h-full flex-col gap-3 px-1 py-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="m-0 text-[0.95rem] font-semibold text-foreground">Incoming transfers</h2>
        {loading ? <span className="text-[0.78rem] text-muted-foreground">Refreshing</span> : null}
      </div>

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
            const isAccepting = acceptingCid === transfer.contractId
            return (
              <article
                key={transfer.contractId}
                className="rounded-md border border-border bg-surface px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.95rem] font-semibold text-foreground">{label}</p>
                    <p className="m-0 mt-1 font-mono text-[0.76rem] text-muted-foreground">
                      from:{' '}
                      {transferView?.sender === undefined
                        ? 'unknown'
                        : shortMiddle(transferView.sender, 10, 6)}
                    </p>
                  </div>
                  <PrimaryButton
                    className="shrink-0 px-3 py-1.5 text-[0.82rem]"
                    disabled={isAccepting}
                    onClick={() => {
                      void onAccept(transfer.contractId)
                    }}
                  >
                    {isAccepting ? 'Accepting...' : 'Accept'}
                  </PrimaryButton>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
