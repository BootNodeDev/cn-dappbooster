import { useMemo } from 'react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ProposalCard } from '@/components/ProposalCard'
import { toast } from '@/components/toast'
import { useNow } from '@/lib/clock'
import type { Proposal } from '@/store/types'
import { useVesting, useVestingStore } from '@/store/useVestingStore'

export const ProposalsPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const proposals = useVestingStore((s) => s.proposals)
  const accept = useVestingStore((s) => s.accept)

  // Incoming: addressed to me, awaiting my acceptance. Outgoing: I proposed them.
  const incoming = useMemo<Proposal[]>(
    () => proposals.filter((p) => p.receiver === partyId),
    [proposals, partyId],
  )
  const outgoing = useMemo<Proposal[]>(
    () => proposals.filter((p) => p.proposer === partyId),
    [proposals, partyId],
  )

  const onAccept = async (proposal: Proposal): Promise<void> => {
    try {
      await accept(backend, partyId, proposal.id)
      toast.success('Proposal accepted, escrow active')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        title="No proposals"
        description="Escrow proposals you send or receive appear here, waiting to be accepted."
        action={
          <Button asLink to="/create" size="sm">
            Create an escrow
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {incoming.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-extrabold tracking-tight text-fg">Incoming</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {incoming.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                direction="incoming"
                nowMs={nowMs}
                onAccept={(p) => void onAccept(p)}
              />
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-extrabold tracking-tight text-fg">Outgoing</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {outgoing.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                direction="outgoing"
                nowMs={nowMs}
                onAccept={(p) => void onAccept(p)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
