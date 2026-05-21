import { useEffect, useState } from 'react'
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
  const [signInput, setSignInput] = useState<string>('hello canton')
  const [signature, setSignature] = useState<string | undefined>(undefined)
  const [lastTxStatus, setLastTxStatus] = useState<string | undefined>(undefined)
  const [lastTxCommandId, setLastTxCommandId] = useState<string | undefined>(undefined)

  const loadCounters = async (state = connected): Promise<void> => {
    if (state === undefined) {
      return
    }
    // Participant-native ACS body: requires the cumulative filter shape
    // plus activeAtOffset. wallet-service is a transparent pass-through
    // since the SDK-side shim was dropped, so the dApp must send the
    // shape the Canton JSON API expects directly.
    const ledgerEnd = await state.client.ledgerApi({
      requestMethod: 'get',
      resource: '/v2/state/ledger-end'
    }) as { offset?: number }
    if (typeof ledgerEnd.offset !== 'number') {
      throw new Error('ledger-end did not return an offset')
    }
    const response = await state.client.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: {
          filtersByParty: {
            [state.account.partyId]: {
              cumulative: [{
                identifierFilter: {
                  TemplateFilter: {
                    value: {
                      templateId: COUNTER_TEMPLATE_ID,
                      includeCreatedEventBlob: true
                    }
                  }
                }
              }]
            }
          }
        },
        activeAtOffset: ledgerEnd.offset,
        verbose: true
      }
    }) as unknown[]
    setCounters((Array.isArray(response) ? response : []).flatMap(row => {
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
    // Tear down the connected UI synchronously so a hung wallet response
    // cannot trap the user in busy state. Any in-flight request that
    // eventually resolves writes to state that is no longer mounted.
    const client = connected.client
    setConnected(undefined)
    setCounters([])
    setPartyDrafts({})
    setPairingUri(undefined)
    setPairingCopied(false)
    setBusy(false)

    try {
      await client.disconnect()
      toast.success('Disconnected.')
    } catch (err) {
      toast.error(`Local logout complete; wallet disconnect failed: ${(err as Error).message}`)
    }
  }

  // Subscribe to wallet-pushed accountsChanged events. When the user switches
  // the primary account in Carpincho, the connected party may shift — re-read
  // accounts and reload counters for the new primary.
  useEffect(() => {
    if (connected === undefined) {
      return
    }
    const handler = async (payload: unknown): Promise<void> => {
      try {
        const accounts = Array.isArray(payload) ? payload : await connected.client.listAccounts()
        const primary = (accounts as Array<{ primary?: boolean; partyId: string }>).find(a => a.primary === true)
        if (primary === undefined) {
          return
        }
        if (primary.partyId !== connected.account.partyId) {
          setConnected({
            client: connected.client,
            account: { ...connected.account, partyId: primary.partyId }
          })
          toast.success(`Active party changed to ${short(primary.partyId)}`)
        }
        await loadCounters({
          client: connected.client,
          account: { ...connected.account, partyId: primary.partyId }
        })
      } catch (err) {
        toast.error((err as Error).message)
      }
    }
    connected.client.onAccountsChanged(handler)
    return () => {
      connected.client.removeOnAccountsChanged(handler)
    }
  }, [connected])

  // Subscribe to wallet-pushed txChanged events. Surfaces the lifecycle
  // (pending → signed → executed / failed) as a small indicator alongside the
  // counter card so the user sees that a transaction is in flight.
  useEffect(() => {
    if (connected === undefined) {
      return
    }
    const handler = (payload: unknown): void => {
      if (typeof payload !== 'object' || payload === null) {
        return
      }
      const evt = payload as { status?: unknown; commandId?: unknown }
      if (typeof evt.status === 'string') {
        setLastTxStatus(evt.status)
      }
      if (typeof evt.commandId === 'string') {
        setLastTxCommandId(evt.commandId)
      }
    }
    connected.client.onTxChanged(handler)
    return () => {
      connected.client.removeOnTxChanged(handler)
    }
  }, [connected])

  const onSignMessage = async (): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)
    setSignature(undefined)
    try {
      const messageBase64 = window.btoa(unescape(encodeURIComponent(signInput)))
      // DappClient doesn't expose signMessage as a typed method; reach through
      // the underlying Provider per the dapp-api spec.
      const result = await connected.client.getProvider().request({
        method: 'signMessage',
        params: { message: messageBase64 }
      }) as { signature: string }
      setSignature(result.signature)
      toast.success('Message signed.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
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
      <h1 className="app-title">Canton Counter</h1>
      {connected === undefined ? (
        <div className="session-controls" aria-label="Connect wallet">
          <button
            className="connect-chip carpincho-connect"
            data-testid="connect-extension"
            type="button"
            onClick={() => { void onConnect('extension') }}
            disabled={busy}
          >
            <span className="connect-glyph" aria-hidden="true">C</span>
            <span>{busy && connectMode === 'extension' ? 'Connecting' : 'Carpincho'}</span>
          </button>
          <button
            className="connect-chip"
            data-testid="connect-walletconnect"
            type="button"
            onClick={() => { void onConnect('walletconnect') }}
            disabled={busy}
          >
            <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
            <span>{busy && connectMode === 'walletconnect' ? 'Pairing' : 'WC'}</span>
          </button>
        </div>
      ) : (
        <div className="session-controls">
          <span
            className="connected-party"
            data-testid="connected-party"
            data-party-id={connected.account.partyId}
          >party:{short(connected.account.partyId)}</span>
          <button
            className="logout-icon"
            data-testid="logout"
            type="button"
            onClick={() => { void onDisconnect() }}
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
        {connected === undefined ? (
          <div className="empty">
            <p className="empty-title">Connect to continue</p>
          </div>
        ) : (
          <>
          <div className="actions">
            <button
              className="primary"
              data-testid="new-counter"
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

            <div className="counter-list-label">Your counters:</div>
            {counters.length === 0 ? (
              <div className="empty">
                <p>No counters created yet.</p>
              </div>
            ) : (
              <section className="counter-grid">
            {counters.map(counter => {
              const isIssuer = counter.issuer === connected.account.partyId
              const draft = draftFor(counter.contractId)
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
                      data-testid="party-id-input"
                      value={draft}
                      onChange={event => updateDraft(counter.contractId, event.target.value)}
                      placeholder="party id"
                      disabled={!isIssuer || busy}
                    />
                    <button
                      data-testid="add-user"
                      onClick={() => { void runCommand('add-user', addUserCommand(counter, draft.trim())) }}
                      disabled={!isIssuer || busy || draft.trim() === ''}
                    >
                      Add user
                    </button>
                    <button
                      data-testid="add-viewer"
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
          </>
        )}
      </section>

      {lastTxStatus !== undefined && (
        <section
          className="workspace-panel"
          data-testid="tx-status"
          data-tx-status={lastTxStatus}
          data-tx-command-id={lastTxCommandId ?? ''}
        >
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Last transaction</span>
              <h2>Status: {lastTxStatus}</h2>
            </div>
          </div>
          {lastTxCommandId !== undefined && lastTxCommandId.length > 0 && (
            <code>{short(lastTxCommandId)}</code>
          )}
        </section>
      )}

      {connected !== undefined && (
        <section className="workspace-panel" data-testid="signing-panel">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Wallet capability</span>
              <h2>Sign message</h2>
            </div>
          </div>
          <div className="counter-card">
            <p>
              Exercises CIP-0103 <code>signMessage</code> against the connected wallet.
              The wallet asks for approval, signs with the active party's key, and returns
              the Ed25519 signature in base64. Useful for "prove you own this party"
              challenges from a backend.
            </p>
            <input
              type="text"
              data-testid="sign-input"
              value={signInput}
              onChange={event => setSignInput(event.target.value)}
              placeholder="Message to sign"
              disabled={busy}
            />
            <button
              data-testid="sign-message"
              type="button"
              onClick={() => { void onSignMessage() }}
              disabled={busy}
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
