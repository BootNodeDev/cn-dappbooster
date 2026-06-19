import { useEffect, useMemo, useRef, useState } from 'react'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { transferDirection } from '@/cip56/transfers'
import { ActivityList } from '@/components/ActivityList'
import { TransferCard } from '@/components/TransferCard'
import { TransferDetailsSheet } from '@/components/TransferDetailsSheet'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from '@/components/ui/toast'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { usePendingCip56Transfers } from '@/hooks/usePendingCip56Transfers'
import type { AccountPublic, TransactionRecord } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface ActivityPanelProps {
  account?: AccountPublic
  transactions: TransactionRecord[]
  api?: Cip56TransferApi
  onPendingCountChange?: (count: number) => void
}

// Activity tab body: actionable + in-flight transfers pinned above the settled history feed.
export const ActivityPanel = ({
  account,
  transactions,
  api,
  onPendingCountChange,
}: ActivityPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [acceptingCid, setAcceptingCid] = useState<string | undefined>(undefined)
  const [detailsTransfer, setDetailsTransfer] = useState<PendingTokenTransfer | null>(null)
  const { transfers, loading, error, accept } = usePendingCip56Transfers(activeAccount, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })

  const { incoming, outgoing } = useMemo(() => {
    const partyId = activeAccount?.partyId
    const incomingTransfers: PendingTokenTransfer[] = []
    const outgoingTransfers: PendingTokenTransfer[] = []
    for (const transfer of transfers) {
      if (transferDirection(transfer, partyId) === 'outgoing') {
        outgoingTransfers.push(transfer)
      } else {
        incomingTransfers.push(transfer)
      }
    }
    return { incoming: incomingTransfers, outgoing: outgoingTransfers }
  }, [transfers, activeAccount?.partyId])

  // Hold the latest callback in a ref so the count effects don't depend on its identity;
  // a parent that re-creates the callback must not trigger a spurious reset mid-session.
  const onPendingCountChangeRef = useRef(onPendingCountChange)
  useEffect(() => {
    onPendingCountChangeRef.current = onPendingCountChange
  })

  // Only incoming transfers need receiver action, so the badge counts those alone.
  useEffect(() => {
    onPendingCountChangeRef.current?.(incoming.length)
  }, [incoming.length])

  // Reset the parent's count when this panel unmounts (e.g. account teardown).
  useEffect(() => {
    return () => onPendingCountChangeRef.current?.(0)
  }, [])

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

  const hasPending = incoming.length > 0 || outgoing.length > 0

  return (
    <div className="flex min-h-full flex-col gap-3 px-1 pt-3 pb-2">
      {error === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      )}

      {incoming.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 flex items-center gap-2 px-0.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-foreground">
            Needs action <span className="text-accent">· {incoming.length}</span>
          </h2>
          {incoming.map((transfer) => (
            <TransferCard
              key={transfer.contractId}
              transfer={transfer}
              direction="incoming"
              isAccepting={acceptingCid === transfer.contractId}
              onAccept={onAccept}
              onOpenDetails={setDetailsTransfer}
            />
          ))}
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 flex items-center gap-1.5 px-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
            Awaiting acceptance <span>· {outgoing.length}</span>
          </h2>
          {outgoing.map((transfer) => (
            <TransferCard
              key={transfer.contractId}
              transfer={transfer}
              direction="outgoing"
              onOpenDetails={setDetailsTransfer}
            />
          ))}
        </section>
      ) : null}

      {loading && !hasPending && transactions.length === 0 ? (
        <LoadingState label="Loading transfers" />
      ) : (
        <ActivityList transactions={transactions} />
      )}

      <TransferDetailsSheet
        transfer={detailsTransfer}
        onClose={() => setDetailsTransfer(null)}
      />
    </div>
  )
}
