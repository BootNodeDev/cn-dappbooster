import type { CounterContract } from '../counterSignature.js'
import type { ConnectedState } from '../hooks/useCounterWorkspace.js'
import { CounterCard } from './CounterCard.js'

interface CounterWorkspaceProps {
  connected: ConnectedState | undefined
  counters: CounterContract[]
  busy: boolean
  partyDrafts: Record<string, string>
  onCreateCounter: () => Promise<void>
  onIncrementCounter: (counter: CounterContract) => Promise<void>
  onAddUser: (counter: CounterContract, partyId: string) => Promise<void>
  onAddViewer: (counter: CounterContract, partyId: string) => Promise<void>
  onDraftChange: (contractId: string, value: string) => void
}

export const CounterWorkspace = ({
  connected,
  counters,
  busy,
  partyDrafts,
  onCreateCounter,
  onIncrementCounter,
  onAddUser,
  onAddViewer,
  onDraftChange
}: CounterWorkspaceProps): JSX.Element => (
  <section className="workspace-panel">
    <div className="panel-title-row">
      <div>
        <span className="section-kicker">Business</span>
        <h2>Counter workspace</h2>
      </div>
      <div className="actions">
        <button
          className="primary"
          onClick={() => { void onCreateCounter() }}
          disabled={busy || connected === undefined}
        >
          New counter
        </button>
      </div>
    </div>

    {connected === undefined ? (
      <div className="empty">
        <h3>No wallet connected</h3>
        <p>Connect Carpincho before creating or exercising Counter contracts.</p>
      </div>
    ) : counters.length === 0 ? (
      <div className="empty">
        <h3>No counters visible</h3>
        <p>Create one with the connected party or ask another party to add you as viewer.</p>
      </div>
    ) : (
      <section className="counter-grid">
        {counters.map(counter => (
          <CounterCard
            key={counter.contractId}
            counter={counter}
            connectedPartyId={connected.account.partyId}
            busy={busy}
            draft={partyDrafts[counter.contractId] ?? ''}
            onDraftChange={onDraftChange}
            onIncrement={onIncrementCounter}
            onAddUser={onAddUser}
            onAddViewer={onAddViewer}
          />
        ))}
      </section>
    )}
  </section>
)
