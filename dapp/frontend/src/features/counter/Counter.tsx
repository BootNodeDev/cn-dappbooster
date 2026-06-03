import { useExecute, useLedger, useParty } from 'canton-connect-kit'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatPartyId, shortenIdentifier } from '../../utils/formatPartyId.js'
import {
  addUserCommand,
  addViewerCommand,
  COUNTER_PACKAGE_ID,
  COUNTER_TEMPLATE_ID,
  type CounterContract,
  createCounterCommand,
  incrementCounterCommand,
  normalizeCounterContract,
} from './counterSignature.js'
import './counter.css'

const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const canIncrement = (counter: CounterContract, partyId: string): boolean =>
  counter.issuer === partyId || counter.incrementors.some(([party]) => party === partyId)

type AccessRole = 'viewer' | 'incrementor'

type PartyDrafts = Record<string, Partial<Record<AccessRole, string>>>

type AccessSectionProps = {
  addTestId: string
  buttonLabel: string
  disabled: boolean
  draft: string
  emptyMessage: string
  inputTestId: string
  onAdd: () => void
  onDraftChange: (value: string) => void
  parties: string[]
  title: string
}

// Renders one access role for a counter so viewers and incrementors keep separate
// lists, empty states, draft inputs, and submit actions.
const AccessSection = ({
  addTestId,
  buttonLabel,
  disabled,
  draft,
  emptyMessage,
  inputTestId,
  onAdd,
  onDraftChange,
  parties,
  title,
}: AccessSectionProps): JSX.Element => (
  <section className="access-section">
    <h3>{title}</h3>
    {parties.length === 0 ? (
      <p className="party-empty">{emptyMessage}</p>
    ) : (
      <ul className="party-list">
        {parties.map((partyId) => (
          <li key={partyId}>{formatPartyId(partyId)}</li>
        ))}
      </ul>
    )}
    <div className="party-tools">
      <input
        data-testid={inputTestId}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="party id"
        disabled={disabled}
      />
      <button
        type="button"
        data-testid={addTestId}
        onClick={onAdd}
        disabled={disabled || draft.trim() === ''}
      >
        {buttonLabel}
      </button>
    </div>
  </section>
)

// Counter example feature. Removable: delete this folder, its import + the
// <Counter /> line in App.tsx, ../e2e/tests/features/counter, and the
// dapp/daml Counter module (see README "Removing a feature").
export const Counter = (): JSX.Element | null => {
  const { party } = useParty()
  const { execute, lastTx, isExecuting } = useExecute()
  const { ledgerApi } = useLedger()

  const [counters, setCounters] = useState<CounterContract[]>([])
  const [partyDrafts, setPartyDrafts] = useState<PartyDrafts>({})

  const busy = isExecuting

  // Reload counters whenever the active party changes (after connect or after
  // accountsChanged). The kit shifts useParty().party.partyId; this effect just
  // re-reads the ACS for the new primary.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the ACS only when the active party identity changes, not on every loadCountersFor identity churn
  useEffect(() => {
    if (party === undefined) {
      setCounters([])
      return
    }
    void loadCountersFor(party.partyId)
  }, [party?.partyId])

  const loadCountersFor = async (partyId: string): Promise<void> => {
    try {
      // Participant-native ACS body: requires the cumulative filter shape
      // plus activeAtOffset. wallet-service is a transparent pass-through
      // since PR-A dropped the SDK-side shim, so the dApp must send the
      // shape the Canton JSON API expects directly.
      const ledgerEnd = (await ledgerApi({
        requestMethod: 'get',
        resource: '/v2/state/ledger-end',
      })) as { offset?: number }
      if (typeof ledgerEnd.offset !== 'number') {
        throw new Error('ledger-end did not return an offset')
      }
      const response = (await ledgerApi({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: {
          filter: {
            filtersByParty: {
              [partyId]: {
                cumulative: [
                  {
                    identifierFilter: {
                      TemplateFilter: {
                        value: {
                          templateId: COUNTER_TEMPLATE_ID,
                          includeCreatedEventBlob: true,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          activeAtOffset: ledgerEnd.offset,
          verbose: true,
        },
      })) as unknown[]
      setCounters(
        (Array.isArray(response) ? response : []).flatMap((row) => {
          const counter = normalizeCounterContract(row)
          return counter === undefined ? [] : [counter]
        }),
      )
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const runCommand = async (prefix: string, command: unknown): Promise<void> => {
    if (party === undefined) {
      return
    }
    try {
      await execute({
        commandId: commandId(prefix),
        commands: [command],
        actAs: [party.partyId],
        readAs: [party.partyId],
        packageIdSelectionPreference: [COUNTER_PACKAGE_ID],
      })
      await loadCountersFor(party.partyId)
      toast.success('Transaction executed.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const draftFor = (contractId: string, role: AccessRole): string =>
    partyDrafts[contractId]?.[role] ?? ''
  const updateDraft = (contractId: string, role: AccessRole, value: string): void => {
    setPartyDrafts((prev) => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [role]: value,
      },
    }))
  }

  if (party === undefined) {
    return null
  }

  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="primary"
          data-testid="new-counter"
          onClick={() => {
            void runCommand('create-counter', createCounterCommand(party.partyId))
          }}
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New counter
        </button>
      </div>

      <div className="counter-list-label">Your counters:</div>
      {counters.length === 0 ? (
        <div className="empty">
          <p>No counters created yet.</p>
        </div>
      ) : (
        <section className="counter-grid">
          {counters.map((counter) => {
            const isIssuer = counter.issuer === party.partyId
            const viewerDraft = draftFor(counter.contractId, 'viewer')
            const incrementorDraft = draftFor(counter.contractId, 'incrementor')
            const incrementors = counter.incrementors.map(([incrementor]) => incrementor)
            return (
              <article
                className="counter-card"
                key={counter.contractId}
                data-testid="counter-card"
                data-count={counter.count}
                data-contract-id={counter.contractId}
                data-issuer={counter.issuer}
                data-incrementors={counter.incrementors.length}
                data-viewers={counter.viewers.length}
              >
                <div className="counter-head">
                  <div>
                    <span>Count</span>
                    <strong>{counter.count}</strong>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    data-testid="increment"
                    onClick={() => {
                      void runCommand(
                        'increment-counter',
                        incrementCounterCommand(counter, party.partyId),
                      )
                    }}
                    disabled={busy || !canIncrement(counter, party.partyId)}
                  >
                    Increment
                  </button>
                </div>

                <dl>
                  <div>
                    <dt>Contract</dt>
                    <dd>{shortenIdentifier(counter.contractId)}</dd>
                  </div>
                  <div>
                    <dt>Issuer</dt>
                    <dd>{formatPartyId(counter.issuer)}</dd>
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

                <div className="access-sections">
                  <AccessSection
                    addTestId="add-viewer"
                    buttonLabel="Add viewer"
                    disabled={!isIssuer || busy}
                    draft={viewerDraft}
                    emptyMessage="There are no viewers."
                    inputTestId="viewer-party-id-input"
                    onAdd={() => {
                      void runCommand('add-viewer', addViewerCommand(counter, viewerDraft.trim()))
                    }}
                    onDraftChange={(value) => updateDraft(counter.contractId, 'viewer', value)}
                    parties={counter.viewers}
                    title="Viewers"
                  />
                  <AccessSection
                    addTestId="add-incrementor"
                    buttonLabel="Add incrementor"
                    disabled={!isIssuer || busy}
                    draft={incrementorDraft}
                    emptyMessage="There are no incrementors."
                    inputTestId="incrementor-party-id-input"
                    onAdd={() => {
                      void runCommand(
                        'add-incrementor',
                        addUserCommand(counter, incrementorDraft.trim()),
                      )
                    }}
                    onDraftChange={(value) => updateDraft(counter.contractId, 'incrementor', value)}
                    parties={incrementors}
                    title="Incrementors"
                  />
                </div>
              </article>
            )
          })}
        </section>
      )}

      {lastTx !== undefined && (
        <section
          className="workspace-panel ui-hidden"
          data-testid="tx-status"
          data-tx-status={lastTx.status}
          data-tx-command-id={lastTx.commandId ?? ''}
        >
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Last transaction</span>
              <h2>Status: {lastTx.status}</h2>
            </div>
          </div>
          {lastTx.commandId !== undefined && lastTx.commandId.length > 0 && (
            <code>{shortenIdentifier(lastTx.commandId)}</code>
          )}
        </section>
      )}
    </>
  )
}
