import { Alert } from '@/components/ui/Alert'
import { PendingActionCard } from '@/components/ui/PendingActionCard'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types'
import type { PendingActions } from '@/views/home/usePendingActions'
import { CANTON_METHOD_CONNECT, CANTON_METHOD_SIGN_MESSAGE, type ProposalEvent } from '@/wc/client'

interface PendingActionsSectionProps extends PendingActions {
  proposal: ProposalEvent | undefined
  pendingSign: PendingSignRequest | undefined
  pendingExecute: PendingExecuteRequest | undefined
  proposalAccount: string | null
  accountsSorted: AccountPublic[]
  busy: boolean
}

// Renders the single active pending request (connect proposal, message sign, or prepare-execute).
// The surrounding approval dialog (a centered Sheet) provides the container chrome.
export const PendingActionsSection = ({
  proposal,
  pendingSign,
  pendingExecute,
  proposalAccount,
  accountsSorted,
  busy,
  onApproveProposal,
  onRejectProposal,
  onApproveSign,
  onRejectSign,
  onApproveExecute,
  onRejectExecute,
}: PendingActionsSectionProps): JSX.Element => {
  // Connect always uses the active account; the proposalAccount mirrors it (no in-dialog picker).
  const connectAccount = accountsSorted.find((a) => a.id === proposalAccount) ?? accountsSorted[0]

  return (
    <>
      {proposal !== undefined ? (
        <PendingActionCard
          method={CANTON_METHOD_CONNECT}
          approveLabel="Connect"
          approveDisabled={busy || proposalAccount === null}
          onApprove={onApproveProposal}
          onReject={onRejectProposal}
          busy={busy}
          payload={{ json: proposal.params }}
        >
          {connectAccount === undefined ? (
            <Alert variant="info">Add an account first before approving.</Alert>
          ) : (
            <div>
              <div className="font-mono text-[0.84rem] font-medium text-muted-foreground">
                account: <span className="text-foreground">{connectAccount.name}</span>
              </div>
              <div className="mt-0.5 font-mono text-[0.78rem] text-muted-foreground">
                {shortMiddle(connectAccount.partyId, 12, 7)}
              </div>
            </div>
          )}
        </PendingActionCard>
      ) : pendingSign !== undefined ? (
        <PendingActionCard
          method={CANTON_METHOD_SIGN_MESSAGE}
          approveLabel="Sign"
          onApprove={onApproveSign}
          onReject={onRejectSign}
          busy={busy}
          payload={{ json: pendingSign.messageBase64 }}
        />
      ) : pendingExecute !== undefined ? (
        <PendingActionCard
          method={pendingExecute.rawMethod}
          approveLabel="Approve"
          onApprove={onApproveExecute}
          onReject={onRejectExecute}
          busy={busy}
          payload={{ json: pendingExecute.params }}
        />
      ) : null}
    </>
  )
}
