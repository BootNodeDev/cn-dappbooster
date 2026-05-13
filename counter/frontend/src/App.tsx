import { useMemo, useState } from 'react'
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
import { loadRuntimeConfig, saveRuntimeConfig, type RuntimeConfig } from './runtimeConfig.js'

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
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(() => loadRuntimeConfig())
  const [runtimeDraft, setRuntimeDraft] = useState<RuntimeConfig>(() => loadRuntimeConfig())
  const [partyDrafts, setPartyDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)

  const partyId = connected?.account.partyId
  const carpinchoUrl = useMemo(() => {
    if (pairingUri === undefined) {
      return runtimeConfig.walletCompanionUrl
    }
    return `${runtimeConfig.walletCompanionUrl}?wc=${encodeURIComponent(pairingUri)}`
  }, [pairingUri, runtimeConfig.walletCompanionUrl])

  const onSaveRuntimeConfig = (): void => {
    const saved = saveRuntimeConfig(runtimeDraft)
    setRuntimeConfig(saved)
    setRuntimeDraft(saved)
    setInfo('Settings saved.')
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
      setBusy(false)
    }
  }

  const onConnect = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    setInfo(undefined)
    try {
      const next = await connectWallet({
        chainId: runtimeConfig.cantonNetwork,
        onUri: setPairingUri
      })
      setConnected(next)
      await loadCounters(next)
      setInfo(`Connected as ${short(next.account.partyId)}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const draftFor = (contractId: string): string => partyDrafts[contractId] ?? ''

  const updateDraft = (contractId: string, value: string): void => {
    setPartyDrafts(prev => ({ ...prev, [contractId]: value }))
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Canton base</p>
          <h1>Counter dApp</h1>
        </div>
        <div className="actions">
          {connected === undefined ? (
            <button className="primary" onClick={() => { void onConnect() }} disabled={busy}>
              Connect Carpincho
            </button>
          ) : (
            <>
              <button onClick={() => { void loadCounters() }} disabled={busy}>Refresh</button>
              <button
                className="primary"
                onClick={() => { void runCommand('create-counter', createCounterCommand(connected.account.partyId)) }}
                disabled={busy}
              >
                New counter
              </button>
            </>
          )}
        </div>
      </section>

      <section className="settings-panel">
        <div>
          <label htmlFor="canton-network">WalletConnect Canton network</label>
          <input
            id="canton-network"
            value={runtimeDraft.cantonNetwork}
            onChange={event => setRuntimeDraft(prev => ({ ...prev, cantonNetwork: event.target.value }))}
            placeholder="canton:local"
          />
        </div>
        <div>
          <label htmlFor="wallet-companion-url">Carpincho URL</label>
          <input
            id="wallet-companion-url"
            value={runtimeDraft.walletCompanionUrl}
            onChange={event => setRuntimeDraft(prev => ({ ...prev, walletCompanionUrl: event.target.value }))}
            placeholder="http://localhost:3011"
          />
        </div>
        <button onClick={onSaveRuntimeConfig} disabled={busy}>Save settings</button>
      </section>

      {pairingUri !== undefined && connected === undefined && (
        <section className="panel">
          <div>
            <h2>WalletConnect pairing</h2>
            <p>Open Carpincho and approve the connection request.</p>
          </div>
          <a className="primary link-button" href={carpinchoUrl} target="_blank" rel="noreferrer">
            Open Carpincho
          </a>
          <pre>{pairingUri}</pre>
        </section>
      )}

      {connected !== undefined && partyId !== undefined && (
        <section className="account-band">
          <div>
            <span>Connected party</span>
            <strong>{partyId}</strong>
          </div>
          <div>
            <span>Template</span>
            <strong>{COUNTER_TEMPLATE_ID}</strong>
          </div>
        </section>
      )}

      {info !== undefined && <div className="info">{info}</div>}
      {error !== undefined && <div className="error">{error}</div>}

      {connected === undefined ? (
        <section className="empty">
          <h2>No wallet connected</h2>
          <p>Start with Carpincho. The dApp will send Counter commands through WalletConnect.</p>
        </section>
      ) : counters.length === 0 ? (
        <section className="empty">
          <h2>No counters visible</h2>
          <p>Create one with the connected party or refresh after another party adds you as viewer.</p>
        </section>
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
    </main>
  )
}
