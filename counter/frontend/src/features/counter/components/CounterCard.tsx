import type { CounterContract } from '../counterSignature.js'
import { canIncrement, short } from '../counterHelpers.js'

interface CounterCardProps {
  counter: CounterContract
  connectedPartyId: string
  busy: boolean
  draft: string
  onDraftChange: (contractId: string, value: string) => void
  onIncrement: (counter: CounterContract) => Promise<void>
  onAddUser: (counter: CounterContract, partyId: string) => Promise<void>
  onAddViewer: (counter: CounterContract, partyId: string) => Promise<void>
}

export const CounterCard = ({
  counter,
  connectedPartyId,
  busy,
  draft,
  onDraftChange,
  onIncrement,
  onAddUser,
  onAddViewer
}: CounterCardProps): JSX.Element => {
  const isIssuer = counter.issuer === connectedPartyId
  const trimmedDraft = draft.trim()

  return (
    <article className="counter-card">
      <div className="counter-head">
        <div>
          <span>Count</span>
          <strong>{counter.count}</strong>
        </div>
        <button
          className="primary"
          onClick={() => { void onIncrement(counter) }}
          disabled={busy || !canIncrement(counter, connectedPartyId)}
        >
          Increment
        </button>
      </div>

      <dl>
        <div>
          <dt>Contract</dt>
          <dd>{short(counter.contractId)}</dd>
        </div>
        <div>
          <dt>Issuer</dt>
          <dd>{short(counter.issuer)}</dd>
        </div>
        <div>
          <dt>Incrementors</dt>
          <dd>{counter.incrementors.length}</dd>
        </div>
        <div>
          <dt>Viewers</dt>
          <dd>{counter.viewers.length}</dd>
        </div>
      </dl>

      <div className="party-tools">
        <input
          value={draft}
          onChange={event => onDraftChange(counter.contractId, event.target.value)}
          placeholder="party id"
          disabled={!isIssuer || busy}
        />
        <button
          onClick={() => { void onAddUser(counter, trimmedDraft) }}
          disabled={!isIssuer || busy || trimmedDraft === ''}
        >
          Add user
        </button>
        <button
          onClick={() => { void onAddViewer(counter, trimmedDraft) }}
          disabled={!isIssuer || busy || trimmedDraft === ''}
        >
          Add viewer
        </button>
      </div>
    </article>
  )
}
