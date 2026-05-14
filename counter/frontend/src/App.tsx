import { useState } from 'react'
import type { DappClient } from '@canton-network/dapp-sdk'
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
import { connectWallet, type WalletAccount } from './wallet.js'
import { loadRuntimeConfig, saveRuntimeConfig } from './runtimeConfig.js'

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
  const [runtimeConfig, setRuntimeConfig] = useState(() => loadRuntimeConfig())
  const [partyDrafts, setPartyDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)

  const onNetworkChange = (network: string): void => {
    const saved = saveRuntimeConfig({ ...runtimeConfig, cantonNetwork: network })
    setRuntimeConfig(saved)
    setError(undefined)
  }

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
    setError(undefined)
    try {
      await connected.client.prepareExecuteAndWait({
        commandId: commandId(prefix),
        commands: [command],
        actAs: [connected.account.partyId],
        readAs: [connected.account.partyId],
        packageIdSelectionPreference: [COUNTER_PACKAGE_ID]
      })
      await loadCounters(connected)
      setInfo('Transaction executed.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }
  }

  const onConnect = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    setInfo(undefined)
    setPairingUri(undefined)
    setPairingCopied(false)
    try {
      const next = await connectWallet({
        chainId: runtimeConfig.cantonNetwork,
        onUri: setPairingUri
      })
      setConnected(next)
      setPairingUri(undefined)
      await loadCounters(next)
      setInfo(`Connected as ${short(next.account.partyId)}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)
    setError(undefined)
    setInfo(undefined)

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
      setInfo('Disconnected.')
    } else {
      setError(`Local logout complete; wallet disconnect failed: ${disconnectError}`)
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
      <header className="app-header">
        <div>
          <p className="eyebrow">Canton base</p>
          <h1>Counter</h1>
        </div>
        <div className="header-actions">
          <select
            className="network-select"
            value={runtimeConfig.cantonNetwork}
            onChange={event => onNetworkChange(event.target.value)}
            aria-label="Network"
          >
            <option value="canton:local">canton:local</option>
          </select>
          <div className="connect-area">
            {connected === undefined ? (
              <button className="primary" type="button" onClick={() => { void onConnect() }} disabled={busy}>
                {busy ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <div className="connected-controls">
                <button className="account-chip" type="button" onClick={() => { void loadCounters() }} disabled={busy}>
                  {short(connected.account.partyId)}
                </button>
                <button className="logout-button" type="button" onClick={() => { void onDisconnect() }} disabled={busy}>
                  Logout
                </button>
              </div>
            )}
            {connected === undefined && (busy || pairingUri !== undefined) && (
              <div className="pairing-popover">
                {pairingUri === undefined ? (
                  <div className="pairing-loading">
                    <span className="spinner" />
                    <span>Preparing WalletConnect...</span>
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
          </div>
        </div>
      </header>

      {info !== undefined && (
        <div className="info dismissible">
          <span>{info}</span>
          <button type="button" onClick={() => setInfo(undefined)}>Close</button>
        </div>
      )}
      {error !== undefined && (
        <div className="error dismissible">
          <span>{error}</span>
          <button type="button" onClick={() => setError(undefined)}>Close</button>
        </div>
      )}

      <section className="workspace-panel">
        <div className="panel-title-row">
          <div>
            <span className="section-kicker">Business</span>
            <h2>Counter workspace</h2>
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
