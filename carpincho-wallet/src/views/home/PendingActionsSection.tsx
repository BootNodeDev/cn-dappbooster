import { Alert } from '@/components/ui/Alert.tsx'
import { CARD_CLASS } from '@/components/ui/Card.tsx'
import { PendingActionCard } from '@/components/ui/PendingActionCard.tsx'
import { Select, SelectItem } from '@/components/ui/Select.tsx'
import { cn } from '@/utils/cn.ts'
import type { AccountPublic } from '@/vault/types.ts'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types.ts'
import type { PendingActions } from '@/views/home/usePendingActions.ts'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_SIGN_MESSAGE,
  type ProposalEvent,
} from '@/wc/client.ts'

interface PendingActionsSectionProps extends PendingActions {
  proposal: ProposalEvent | undefined
  pendingSign: PendingSignRequest | undefined
  pendingExecute: PendingExecuteRequest | undefined
  proposalAccount: string | null
  onProposalAccountChange: (id: string) => void
  accountsSorted: AccountPublic[]
  busy: boolean
}

// Renders the single active pending request (connect proposal, message sign, or prepare-execute)
// inside the expanding card that owns the wallet body while an approval is in flight.
export const PendingActionsSection = ({
  proposal,
  pendingSign,
  pendingExecute,
  proposalAccount,
  onProposalAccountChange,
  accountsSorted,
  busy,
  onApproveProposal,
  onRejectProposal,
  onApproveSign,
  onRejectSign,
  onApproveExecute,
  onRejectExecute,
}: PendingActionsSectionProps): JSX.Element => (
  <section
    className={cn(CARD_CLASS, 'flex min-h-0 flex-1 flex-col overflow-hidden border-success/55')}
  >
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
        {accountsSorted.length === 0 ? (
          <Alert variant="info">Add an account first before approving.</Alert>
        ) : (
          <>
            <label
              className="inline-block mb-2 text-sm"
              htmlFor="proposal-account-select"
            >
              Account
            </label>
            <Select
              id="proposal-account-select"
              className="mb-2"
              value={proposalAccount ?? ''}
              onValueChange={onProposalAccountChange}
            >
              {accountsSorted.map((a) => (
                <SelectItem
                  key={a.id}
                  value={a.id}
                >
                  {a.name}
                </SelectItem>
              ))}
            </Select>
          </>
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
  </section>
)
