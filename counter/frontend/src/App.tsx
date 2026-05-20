import { useState } from 'react'
import type { DappClient } from '@canton-network/dapp-sdk'
import { Toaster, toast } from 'sonner'
import {
  COUNTER_PACKAGE_ID,
  COUNTER_TEMPLATE_ID,
  type CounterContract,
  addUserCommand,
  addViewerCommand,
  createCounterCommand,
  incrementCounterCommand,
  normalizeCounterContract
} from './counterSignature.js'
import { connectWallet, type ConnectWalletMode, type WalletAccount } from './wallet.js'
import { loadRuntimeConfig } from './runtimeConfig.js'

interface ConnectedState {
  client: DappClient
  account: WalletAccount
}

const short = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`

const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const canIncrement = (counter: CounterContract, partyId: string): boolean =>
  counter.issuer === partyId || counter.incrementors.some(([party]) => party === partyId)

export const App = (): JSX.Element => {
  const [connected, setConnected] = useState<ConnectedState | undefined>(undefined)
  const [counters, setCounters] = useState<CounterContract[]>([])
  const [pairingUri, setPairingUri] = useState<string | undefined>(undefined)
  const [pairingCopied, setPairingCopied] = useState(false)
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  const [partyDrafts, setPartyDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [connectMode, setConnectMode] = useState<ConnectWalletMode | undefined>(undefined)

  const loadCounters = async (state = connected): Promise<void> => {
    if (state === undefined) {
      return
    }
    const response = await state.client.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        parties: [state.account.partyId],
        templateIds: [COUNTER_TEMPLATE_ID],
        filterByParty: true
      }
    }) as { contracts?: unknown[] }
    setCounters((response.contracts ?? []).flatMap(row => {
      const counter = normalizeCounterContract(row)
      return counter === undefined ? [] : [counter]
    }))
  }

  const runCommand = async (prefix: string, command: unknown): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)
    try {
      await connected.client.prepareExecuteAndWait({
        commandId: commandId(prefix),
        commands: [command],
        actAs: [connected.account.partyId],
        readAs: [connected.account.partyId],
        packageIdSelectionPreference: [COUNTER_PACKAGE_ID]
      })
      await loadCounters(connected)
      toast.success('Transaction executed.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }
  }

  const onConnect = async (mode: ConnectWalletMode): Promise<void> => {
    setBusy(true)
    setConnectMode(mode)
    setPairingUri(undefined)
    setPairingCopied(false)
    try {
      const next = await connectWallet({
        mode,
        chainId: runtimeConfig.cantonNetwork,
        onUri: setPairingUri
      })
      setConnected(next)
      setPairingUri(undefined)
      await loadCounters(next)
      toast.success(`Connected as ${short(next.account.partyId)}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setConnectMode(undefined)
      setBusy(false)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)

    let disconnectError: string | undefined
    try {
      await connected.client.disconnect()
    } catch (err) {
      disconnectError = (err as Error).message
    } finally {
      setConnected(undefined)
      setCounters([])
      setPartyDrafts({})
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }

    if (disconnectError === undefined) {
      toast.success('Disconnected.')
    } else {
      toast.error(`Local logout complete; wallet disconnect failed: ${disconnectError}`)
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

  const draftFor = (contractId: string): string => partyDrafts[contractId] ?? ''

  const updateDraft = (contractId: string, value: string): void => {
    setPartyDrafts(prev => ({ ...prev, [contractId]: value }))
  }

  return (
    <main className="shell">
      <Toaster position="bottom-center" richColors />
      <header className="app-header">
        {connected === undefined ? (
          <div className="connect-status" aria-label="Connect wallet">
            <button
              className="connect-chip carpincho-connect"
              type="button"
              onClick={() => { void onConnect('extension') }}
              disabled={busy}
            >
              <span className="connect-glyph" aria-hidden="true">C</span>
              <span>{busy && connectMode === 'extension' ? 'Connecting' : 'Carpincho'}</span>
            </button>
            <button
              className="connect-chip"
              type="button"
              onClick={() => { void onConnect('walletconnect') }}
              disabled={busy}
            >
              <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
              <span>{busy && connectMode === 'walletconnect' ? 'Pairing' : 'WC'}</span>
            </button>
          </div>
        ) : (
          <div className="connected-status">
            <span className="connected-party">party:{short(connected.account.partyId)}</span>
            <button
              className="logout-icon"
              type="button"
              onClick={() => { void onDisconnect() }}
              disabled={busy}
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
      </header>
      <h1 className="app-title">Canton Counter</h1>

      {connected === undefined && (busy || pairingUri !== undefined) && (
        <div className="pairing-popover">
          {pairingUri === undefined ? (
            <div className="pairing-loading">
              <span className="spinner" />
              <span>{connectMode === 'walletconnect' ? 'Preparing WalletConnect...' : 'Waiting for Carpincho...'}</span>
            </div>
          ) : (
            <>
              <span>Paste in Carpincho</span>
              <code>{short(pairingUri)}</code>
              <div>
                <button
                  className={pairingCopied ? 'copied' : undefined}
                  type="button"
                  onClick={() => { void copyPairingUri() }}
                >
                  {pairingCopied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={() => {
                  setPairingCopied(false)
                  setPairingUri(undefined)
                }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <section className="workspace-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Counter</span>
            <h2>Counter form</h2>
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                if (connected !== undefined) {
                  void runCommand('create-counter', createCounterCommand(connected.account.partyId))
                }
              }}
              disabled={busy || connected === undefined}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              New counter
            </button>
          </div>
        </div>

        {connected === undefined || counters.length === 0 ? (
          <div className="empty">
            <h3>No counters visible</h3>
            <p>Create one with the connected party or ask another party to add you as viewer.</p>
          </div>
        ) : (
          <section className="counter-grid">
            {counters.map(counter => {
              const isIssuer = counter.issuer === connected.account.partyId
              const draft = draftFor(counter.contractId)
              return (
                <article className="counter-card" key={counter.contractId}>
                  <div className="counter-head">
                    <div>
                      <span>Count</span>
                      <strong>{counter.count}</strong>
                    </div>
                    <button
                      className="primary"
                      onClick={() => { void runCommand('increment-counter', incrementCounterCommand(counter, connected.account.partyId)) }}
                      disabled={busy || !canIncrement(counter, connected.account.partyId)}
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
                      onChange={event => updateDraft(counter.contractId, event.target.value)}
                      placeholder="party id"
                      disabled={!isIssuer || busy}
                    />
                    <button
                      onClick={() => { void runCommand('add-user', addUserCommand(counter, draft.trim())) }}
                      disabled={!isIssuer || busy || draft.trim() === ''}
                    >
                      Add user
                    </button>
                    <button
                      onClick={() => { void runCommand('add-viewer', addViewerCommand(counter, draft.trim())) }}
                      disabled={!isIssuer || busy || draft.trim() === ''}
                    >
                      Add viewer
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </section>
    </main>
  )
}
