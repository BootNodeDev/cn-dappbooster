import { useEffect, useState } from 'react'
import {
  ConnectKitProvider,
  useConnect,
  useExecute,
  useLedger,
  useParty,
  useSignMessage,
  useWalletStatus,
} from 'canton-connect-kit'
import { Toaster, toast } from 'sonner'
import {
  COUNTER_PACKAGE_ID,
  COUNTER_TEMPLATE_ID,
  type CounterContract,
  addUserCommand,
  addViewerCommand,
  createCounterCommand,
  incrementCounterCommand,
  normalizeCounterContract,
} from './counterSignature.js'
import { loadRuntimeConfig } from './runtimeConfig.js'
import { formatPartyId } from './utils/formatPartyId.js'

const short = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`

const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const canIncrement = (counter: CounterContract, partyId: string): boolean =>
  counter.issuer === partyId ||
  counter.incrementors.some(([party]) => party === partyId)

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

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
        data-testid={addTestId}
        onClick={onAdd}
        disabled={disabled || draft.trim() === ''}
      >
        {buttonLabel}
      </button>
    </div>
  </section>
)

export const App = (): JSX.Element => {
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  return (
    <ConnectKitProvider
      config={{
        appName: 'Counter dApp',
        appDescription: 'Counter app for the Canton base',
        network: runtimeConfig.cantonNetwork,
        walletConnectProjectId: envString('VITE_WC_PROJECT_ID'),
      }}
    >
      <Counter />
    </ConnectKitProvider>
  )
}

const Counter = (): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected, pairingUri } =
    useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const {
    signMessage,
    signature,
    isSigning,
    reset: resetSignature,
  } = useSignMessage()
  const { execute, lastTx, isExecuting } = useExecute()
  const { ledgerApi } = useLedger()

  const [counters, setCounters] = useState<CounterContract[]>([])
  const [partyDrafts, setPartyDrafts] = useState<PartyDrafts>({})
  const [pairingCopied, setPairingCopied] = useState(false)
  const [connectMode, setConnectMode] = useState<
    'extension' | 'walletconnect' | undefined
  >(undefined)
  const [signInput, setSignInput] = useState<string>('hello canton')

  const busy = isConnecting || isExecuting

  // Reload counters whenever the active party changes (after connect or after
  // accountsChanged). The kit reacts to accountsChanged internally and shifts
  // useParty().party.partyId; this effect just re-reads the ACS for the new
  // primary.
  useEffect(() => {
    if (!isConnected || party === undefined) {
      setCounters([])
      return
    }
    void loadCountersFor(party.partyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, party?.partyId])

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

  const runCommand = async (
    prefix: string,
    command: unknown,
  ): Promise<void> => {
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

  const onConnect = async (
    mode: 'extension' | 'walletconnect',
  ): Promise<void> => {
    setConnectMode(mode)
    try {
      await connect(mode)
      if (party !== undefined) {
        toast.success(`Connected as ${formatPartyId(party.partyId)}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setConnectMode(undefined)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setCounters([])
    setPartyDrafts({})
    setPairingCopied(false)
    resetSignature()
    await disconnect()
    toast.success('Disconnected.')
  }

  const onSignMessage = async (): Promise<void> => {
    try {
      await signMessage(signInput)
      toast.success('Message signed.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const copyPairingUri = async (): Promise<void> => {
    if (pairingUri === undefined) {
      return
    }
    await navigator.clipboard.writeText(pairingUri)
    setPairingCopied(true)
    window.setTimeout(() => setPairingCopied(false), 1400)
  }

  const draftFor = (contractId: string, role: AccessRole): string =>
    partyDrafts[contractId]?.[role] ?? ''
  const updateDraft = (
    contractId: string,
    role: AccessRole,
    value: string,
  ): void => {
    setPartyDrafts((prev) => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [role]: value,
      },
    }))
  }

  return (
    <main className="shell">
      <Toaster position="bottom-center" richColors />
      <h1 className="app-title">Canton Counter</h1>

      {!isConnected ? (
        <div className="session-controls" aria-label="Connect wallet">
          <button
            className="connect-chip carpincho-connect"
            data-testid="connect-extension"
            type="button"
            onClick={() => {
              void onConnect('extension')
            }}
            disabled={busy}
          >
            <span className="connect-glyph" aria-hidden="true">
              C
            </span>
            <span>
              {busy && connectMode === 'extension' ? 'Connecting' : 'Carpincho'}
            </span>
          </button>
          <button
            className="connect-chip"
            data-testid="connect-walletconnect"
            type="button"
            onClick={() => {
              void onConnect('walletconnect')
            }}
            disabled={busy}
          >
            <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
            <span>
              {busy && connectMode === 'walletconnect' ? 'Pairing' : 'WC'}
            </span>
          </button>
        </div>
      ) : (
        <div className="session-controls">
          <span
            className="connected-party"
            data-testid="connected-party"
            data-party-id={party?.partyId ?? ''}
          >
            party:{formatPartyId(party?.partyId ?? '')}
          </span>
          <button
            className="logout-icon"
            data-testid="logout"
            type="button"
            onClick={() => {
              void onDisconnect()
            }}
            aria-label="Disconnect wallet"
            title="Disconnect wallet"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      )}

      {!isConnected && (isConnecting || pairingUri !== undefined) && (
        <div className="pairing-popover">
          {pairingUri === undefined ? (
            <div className="pairing-loading">
              <span className="spinner" />
              <span>
                {connectMode === 'walletconnect'
                  ? 'Preparing WalletConnect...'
                  : 'Waiting for Carpincho...'}
              </span>
            </div>
          ) : (
            <>
              <span>Paste in Carpincho</span>
              <code>{short(pairingUri)}</code>
              <div>
                <button
                  className={pairingCopied ? 'copied' : undefined}
                  type="button"
                  onClick={() => {
                    void copyPairingUri()
                  }}
                >
                  {pairingCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isConnected && isLocked && (
        <section className="workspace-panel" data-testid="wallet-locked-banner">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Wallet locked</span>
              <h2>Unlock Carpincho to continue</h2>
            </div>
          </div>
          <p>
            Your wallet is locked. Open Carpincho and enter your password — this
            dApp will resume automatically.
          </p>
        </section>
      )}

      <section className="workspace-panel">
        {!isConnected || party === undefined ? (
          <div className="empty">
            <p className="empty-title">Connect to continue</p>
          </div>
        ) : isLocked ? (
          <div className="empty">
            <p className="empty-title">
              Wallet locked — unlock Carpincho to continue.
            </p>
          </div>
        ) : (
          <>
            <div className="actions">
              <button
                className="primary"
                data-testid="new-counter"
                onClick={() => {
                  void runCommand(
                    'create-counter',
                    createCounterCommand(party.partyId),
                  )
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
                  const incrementorDraft = draftFor(
                    counter.contractId,
                    'incrementor',
                  )
                  const incrementors = counter.incrementors.map(
                    ([incrementor]) => incrementor,
                  )
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
                          className="primary"
                          data-testid="increment"
                          onClick={() => {
                            void runCommand(
                              'increment-counter',
                              incrementCounterCommand(counter, party.partyId),
                            )
                          }}
                          disabled={
                            busy || !canIncrement(counter, party.partyId)
                          }
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
                            void runCommand(
                              'add-viewer',
                              addViewerCommand(counter, viewerDraft.trim()),
                            )
                          }}
                          onDraftChange={(value) =>
                            updateDraft(counter.contractId, 'viewer', value)
                          }
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
                          onDraftChange={(value) =>
                            updateDraft(
                              counter.contractId,
                              'incrementor',
                              value,
                            )
                          }
                          parties={incrementors}
                          title="Incrementors"
                        />
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </section>

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
            <code>{short(lastTx.commandId)}</code>
          )}
        </section>
      )}

      {isConnected && !isLocked && (
        <section className="workspace-panel ui-hidden" data-testid="signing-panel">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Wallet capability</span>
              <h2>Sign message</h2>
            </div>
          </div>
          <div className="counter-card">
            <p>
              Exercises CIP-0103 <code>signMessage</code> against the connected
              wallet. The wallet asks for approval, signs with the active
              party's key, and returns the Ed25519 signature in base64. Useful
              for "prove you own this party" challenges from a backend.
            </p>
            <input
              type="text"
              data-testid="sign-input"
              value={signInput}
              onChange={(event) => setSignInput(event.target.value)}
              placeholder="Message to sign"
              disabled={isSigning}
            />
            <button
              data-testid="sign-message"
              type="button"
              onClick={() => {
                void onSignMessage()
              }}
              disabled={isSigning}
            >
              Sign with active party
            </button>
            {signature !== undefined && (
              <div data-testid="signature-output" data-signature={signature}>
                <span className="kicker">Signature (base64)</span>
                <code>{short(signature)}</code>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
