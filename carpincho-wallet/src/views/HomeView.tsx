import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useVault } from '../vault/useVault.js'
import { AddAccountView } from './AddAccountView.js'
import { ConnectionSettingsView } from './ConnectionSettingsView.js'
import {
  approveProposal,
  disconnectSession,
  getConnectedDappSessions,
  pairWithUri,
  rejectProposal,
  respondWithError,
  respondWithResult,
  subscribeToSessionChanges,
  subscribeToProposals,
  subscribeToRequests,
  type ConnectedDappSession,
  type ProposalEvent,
  type RequestEvent,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE
} from '../wc/client.js'
import { selectedAccount, type AccountSnapshot } from '../wc/accounts.js'
import type { AccountPublic, TransactionRecord } from '../vault/types.js'
import { walletServiceRequest } from '../api/walletService.js'
import {
  dispatchProviderRequest,
  type ProviderRequest,
  type ProviderResponder
} from '../provider/dispatch.js'
import {
  createRuntimeResponder,
  getPendingProviderRequests,
  isExtensionRuntime,
  subscribeToPendingProviderRequests
} from '../extension/runtimeClient.js'
import type { RuntimePendingRequest } from '../extension/messages.js'

interface PendingSignRequest {
  account: AccountPublic
  messageBase64: string
  responder: ProviderResponder
}

interface PendingExecuteRequest {
  account: AccountPublic
  method: typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
  params: Record<string, unknown>
  rawMethod: string
  responder: ProviderResponder
}

interface PreparedTransactionResponse {
  preparedTransaction: string
  preparedTransactionHash: string
  hashingSchemeVersion: 'HASHING_SCHEME_VERSION_UNSPECIFIED' | 'HASHING_SCHEME_VERSION_V2' | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
}

interface ExecutePreparedResponse {
  updateId?: string
  completionOffset?: number
}

const executeParams = (params: unknown, partyId: string): Record<string, unknown> => {
  const base = typeof params === 'object' && params !== null && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {}
  const actAs = Array.isArray(base.actAs) && base.actAs.length > 0 ? base.actAs : [partyId]
  return {
    ...base,
    partyId,
    actAs,
    readAs: Array.isArray(base.readAs) ? base.readAs : actAs
  }
}

const shortMiddle = (value: string, head = 10, tail = 6): string => {
  if (value.length <= head + tail + 1) {
    return value
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

const commandCount = (params: Record<string, unknown>): number | undefined => {
  const commands = params.commands
  return Array.isArray(commands) ? commands.length : undefined
}

const commandSummary = (params: Record<string, unknown>): string => {
  const commands = params.commands
  if (!Array.isArray(commands) || commands.length === 0) {
    return 'Canton transaction'
  }
  const first = commands[0]
  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    return `${commands.length} command${commands.length === 1 ? '' : 's'}`
  }
  const [kind] = Object.keys(first)
  if (kind === undefined) {
    return `${commands.length} command${commands.length === 1 ? '' : 's'}`
  }
  return commands.length === 1 ? kind : `${kind} + ${commands.length - 1} more`
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const txTime = (tx: TransactionRecord): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(tx.createdAt)

const txMethodLabel = (method: string): string =>
  method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT ? 'executeAndWait' : method

const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const avatarStyle = (value: string): CSSProperties => {
  const hue = hashString(value) % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue} 78% 58%), hsl(${(hue + 62) % 360} 78% 46%))`
  }
}

const initials = (name: string): string => name.slice(0, 2).toUpperCase()

type WalletScreen = 'home' | 'add-account'

const walletConnectResponder = (req: RequestEvent): ProviderResponder => ({
  result: async value => {
    await respondWithResult(req.topic, req.id, value)
  },
  error: async (code, message) => {
    await respondWithError(req.topic, req.id, code, message)
  }
})

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [screen, setScreen] = useState<WalletScreen>('home')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pairingDraft, setPairingDraft] = useState('')
  const [pairingBusy, setPairingBusy] = useState(false)
  const [sessions, setSessions] = useState<ConnectedDappSession[]>([])
  const [proposal, setProposal] = useState<ProposalEvent | undefined>(undefined)
  const [proposalAccount, setProposalAccount] = useState<string | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSignRequest | undefined>(undefined)
  const [pendingExecute, setPendingExecute] = useState<PendingExecuteRequest | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const accountSnapshotRef = useRef<AccountSnapshot>({ accounts: v.accounts, primary: v.primary })
  const seenExtensionRequests = useRef<Set<string>>(new Set())
  const extensionMode = isExtensionRuntime()

  // Strip ?wc= after pairing so a refresh does not try the same URI twice.
  useEffect(() => {
    if (extensionMode) {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const wc = params.get('wc')
    if (wc === null || wc === '') {
      return
    }
    pairWithUri(wc)
      .then(() => {
        params.delete('wc')
        const newQuery = params.toString()
        const url = `${window.location.pathname}${newQuery === '' ? '' : `?${newQuery}`}${window.location.hash}`
        window.history.replaceState(null, '', url)
      })
      .catch((err: Error) => setError(`pair failed: ${err.message}`))
  }, [extensionMode])

  useEffect(() => {
    if (proposal === undefined) {
      setProposalAccount(null)
      return
    }
    setProposalAccount(prev => prev ?? v.primary?.id ?? v.accounts[0]?.id ?? null)
  }, [proposal, v.primary, v.accounts])

  useEffect(() => {
    accountSnapshotRef.current = { accounts: v.accounts, primary: v.primary }
  }, [v.accounts, v.primary])

  // Lazy so newly added accounts are visible to in-flight requests.
  const resolveAccounts = useCallback(() => ({
    accounts: accountSnapshotRef.current.accounts,
    primary: accountSnapshotRef.current.primary
  }), [])

  const refreshSessions = useCallback(async (): Promise<void> => {
    setSessions(await getConnectedDappSessions())
  }, [])

  const handleProviderRequest = useCallback(async (
    request: ProviderRequest,
    responder: ProviderResponder,
    context: { label: string; rawMethod?: string }
  ): Promise<void> => {
    const result = await dispatchProviderRequest(request, resolveAccounts, responder)
    if (result.status === 'pending-approval' && result.pendingMethod === CANTON_METHOD_SIGN_MESSAGE) {
      const messageBase64 = (request.params as { message?: string })?.message
      if (typeof messageBase64 !== 'string') {
        await responder.error(-32602, 'message param missing')
        return
      }
      const account = selectedAccount(resolveAccounts())
      if (account === undefined) {
        await responder.error(-32000, 'no account available')
        return
      }
      setPendingSign({ account, messageBase64, responder })
      return
    }
    if (
      result.status === 'pending-approval' &&
      (result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE || result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT)
    ) {
      const account = selectedAccount(resolveAccounts())
      if (account === undefined) {
        await responder.error(-32000, 'no account available')
        return
      }
      setPendingExecute({
        account,
        method: result.pendingMethod,
        params: executeParams(request.params, account.partyId),
        rawMethod: context.rawMethod ?? request.method,
        responder
      })
    }
  }, [resolveAccounts])

  const handleExtensionPending = useCallback(async (pending: RuntimePendingRequest): Promise<void> => {
    if (seenExtensionRequests.current.has(pending.requestId)) {
      return
    }
    seenExtensionRequests.current.add(pending.requestId)
    try {
      await handleProviderRequest(
        {
          method: pending.request.method,
          params: pending.request.params
        },
        createRuntimeResponder(pending),
        { label: pending.origin }
      )
    } catch (error) {
      console.error('[carpincho:extension] request handler failed', { pending, error })
      setError(`Extension request failed: ${(error as Error).message}`)
    }
  }, [handleProviderRequest])

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsub: (() => void) | undefined
    void subscribeToSessionChanges(setSessions)
      .then(fn => { unsub = fn })
      .catch((err: Error) => setError(`WalletConnect sessions failed: ${err.message}`))
    return () => { unsub?.() }
  }, [extensionMode])

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsubP: (() => void) | undefined
    let unsubR: (() => void) | undefined
    void (async () => {
      setError(undefined)
      unsubP = await subscribeToProposals(setProposal)
      unsubR = await subscribeToRequests(async (req) => {
        try {
          await handleProviderRequest(
            {
              method: req.params.request.method,
              params: req.params.request.params
            },
            walletConnectResponder(req),
            { label: 'WalletConnect', rawMethod: req.params.request.method }
          )
        } catch (error) {
          console.error('[carpincho:wc] request handler failed', { req, error })
          setError(`WalletConnect request failed: ${(error as Error).message}`)
        }
      })
    })().catch((err: Error) => setError(`WalletConnect init failed: ${err.message}`))
    return () => {
      unsubP?.()
      unsubR?.()
    }
  }, [extensionMode, handleProviderRequest])

  useEffect(() => {
    if (!extensionMode) {
      return
    }
    const unsubscribe = subscribeToPendingProviderRequests(pending => {
      void handleExtensionPending(pending)
    })
    void getPendingProviderRequests()
      .then(pendingRequests => {
        for (const pending of pendingRequests) {
          void handleExtensionPending(pending)
        }
      })
      .catch((err: Error) => setError(`Extension requests failed: ${err.message}`))
    return unsubscribe
  }, [extensionMode, handleExtensionPending])

  const onApproveProposal = async (): Promise<void> => {
    if (proposal === undefined || proposalAccount === null) {
      return
    }
    const account = v.accounts.find(a => a.id === proposalAccount)
    if (account === undefined) {
      setError('select an account first')
      return
    }
    setBusy(true)
    try {
      await approveProposal({ proposal, partyId: account.partyId })
      await refreshSessions()
      setProposal(undefined)
    } catch (err) {
      setError(`approve failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const onRejectProposal = async (): Promise<void> => {
    if (proposal === undefined) {
      return
    }
    await rejectProposal(proposal.id).catch(() => undefined)
    setProposal(undefined)
  }

  const onApproveSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    setBusy(true)
    try {
      const signature = await v.signMessage(pendingSign.account.id, pendingSign.messageBase64)
      await pendingSign.responder.result({ signature })
      setInfo('Signed.')
      setPendingSign(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingSign.responder.error(-32000, msg).catch(() => undefined)
      setError(`sign failed: ${msg}`)
      setPendingSign(undefined)
    } finally {
      setBusy(false)
    }
  }

  const onRejectSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    await pendingSign.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingSign(undefined)
  }

  const onApproveExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    setBusy(true)
    try {
      const prepared = await walletServiceRequest<PreparedTransactionResponse>('prepareTransaction', pendingExecute.params)
      const signatureBase64 = await v.signMessage(pendingExecute.account.id, prepared.preparedTransactionHash)
      const executed = await walletServiceRequest<ExecutePreparedResponse>('executePrepared', {
        ...prepared,
        partyId: pendingExecute.account.partyId,
        signatureBase64
      })

      await v.recordTransaction({
        accountId: pendingExecute.account.id,
        accountName: pendingExecute.account.name,
        partyId: pendingExecute.account.partyId,
        network: pendingExecute.account.network,
        method: pendingExecute.method,
        status: 'executed',
        preparedTransactionHash: prepared.preparedTransactionHash,
        commandId: optionalString(pendingExecute.params.commandId),
        submissionId: optionalString(pendingExecute.params.submissionId),
        updateId: executed.updateId,
        completionOffset: executed.completionOffset,
        commandCount: commandCount(pendingExecute.params),
        summary: commandSummary(pendingExecute.params)
      })

      const tx = {
        status: 'executed',
        commandId: optionalString(pendingExecute.params.commandId) ?? '',
        payload: {
          updateId: executed.updateId ?? '',
          completionOffset: executed.completionOffset ?? 0
        }
      }
      const isLegacyPrepareSign = pendingExecute.rawMethod === 'canton_prepareSignExecute'
      const result =
        pendingExecute.method === CANTON_METHOD_PREPARE_EXECUTE
          ? null
          : isLegacyPrepareSign ? tx : { tx }
      await pendingExecute.responder.result(result)
      setInfo('Transaction executed.')
      setPendingExecute(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingExecute.responder.error(-32000, msg).catch(() => undefined)
      setError(`transaction failed: ${msg}`)
      setPendingExecute(undefined)
    } finally {
      setBusy(false)
    }
  }

  const onRejectExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    await pendingExecute.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingExecute(undefined)
  }

  const onPairDapp = async (): Promise<void> => {
    const uri = pairingDraft.trim()
    if (uri === '') {
      setError('Paste a WalletConnect pairing URI first.')
      return
    }
    setPairingBusy(true)
    setError(undefined)
    setInfo(undefined)
    try {
      await pairWithUri(uri)
      setPairingDraft('')
    } catch (err) {
      setError(`pairing failed: ${(err as Error).message}`)
    } finally {
      setPairingBusy(false)
    }
  }

  const onDisconnectDapp = async (topic: string): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await disconnectSession(topic)
      await refreshSessions()
    } catch (err) {
      setError(`disconnect failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const accountsSorted = useMemo(
    () => [...v.accounts].sort((a, b) => (a.isPrimary === b.isPrimary ? a.createdAt - b.createdAt : a.isPrimary ? -1 : 1)),
    [v.accounts]
  )
  const primary = v.primary ?? accountsSorted[0]
  const visibleTxs = v.transactions.slice(0, 8)
  const hasPending = proposal !== undefined || pendingSign !== undefined || pendingExecute !== undefined
  const connectedSession = sessions[0]

  if (screen === 'add-account') {
    return (
      <div className="wallet-home">
        <section className="page-panel">
          <div className="page-title-row">
            <button className="link-action" type="button" onClick={() => setScreen('home')}>
              Back
            </button>
            <h5>Add account</h5>
            <span />
          </div>
          <AddAccountView onClose={() => setScreen('home')} />
        </section>
      </div>
    )
  }

  return (
    <div className="wallet-home">
      {info !== undefined && (
        <div className="info-box dismissible mb-3">
          <span>{info}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setInfo(undefined)}>Close</button>
        </div>
      )}
      {error !== undefined && (
        <div className="error-box dismissible mb-3">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>Close</button>
        </div>
      )}

      <section className="wallet-hero">
        <div className="wallet-hero-top">
          <span className="network-pill">{primary?.network ?? 'canton:local'}</span>
          <button className="settings-trigger" type="button" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        {primary === undefined ? (
          <div className="wallet-empty-state">
            <div>No account</div>
            <button className="btn btn-wallet mt-3" type="button" onClick={() => setScreen('add-account')}>
              Create account
            </button>
          </div>
        ) : (
          <>
            <div className="account-control-row">
              <div className="account-switcher-wrap">
                <button
                  className="account-switcher"
                  type="button"
                  onClick={() => setAccountMenuOpen(open => !open)}
                  aria-expanded={accountMenuOpen}
                >
                  <span className="account-avatar small" style={avatarStyle(primary.partyId)}>{initials(primary.name)}</span>
                  <span className="account-switcher-copy">
                    <span>{primary.name}</span>
                    <small>{shortMiddle(primary.partyId, 11, 6)}</small>
                  </span>
                  <span className={`chevron ${accountMenuOpen ? 'open' : ''}`} aria-hidden="true" />
                </button>
                {accountMenuOpen && (
                  <div className="account-dropdown">
                    <div className="dropdown-kicker">Connected wallet</div>
                    {accountsSorted.map(a => (
                      <button
                        key={a.id}
                        className={`dropdown-account ${a.isPrimary ? 'active' : ''}`}
                        type="button"
                        onClick={() => {
                          void v.setPrimary(a.id)
                          setAccountMenuOpen(false)
                        }}
                      >
                        <span className="account-avatar small" style={avatarStyle(a.partyId)}>{initials(a.name)}</span>
                        <span className="dropdown-account-copy">
                          <strong>{a.name}</strong>
                          <small>{shortMiddle(a.partyId, 14, 7)}</small>
                        </span>
                        {a.isPrimary && <span className="tag">current</span>}
                      </button>
                    ))}
                    <button
                      className="dropdown-create"
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        setScreen('add-account')
                      }}
                    >
                      Create another account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section className={`wallet-section connection-panel ${hasPending ? 'needs-action' : ''}`}>
        {proposal !== undefined ? (
          <div className="connection-request">
            <div className="connection-heading">
              <span className="connection-icon hot">!</span>
              <div>
                <h5>Action required</h5>
                <small>{proposal.params.proposer.metadata.name} wants to connect</small>
              </div>
            </div>
            {accountsSorted.length === 0 ? (
              <div className="info-box">Add an account first before approving.</div>
            ) : (
              <>
                <label className="form-label small">Account</label>
                <select
                  className="form-select mb-3"
                  value={proposalAccount ?? ''}
                  onChange={e => setProposalAccount(e.target.value)}
                >
                  {accountsSorted.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {shortMiddle(a.partyId, 12, 6)}
                    </option>
                  ))}
                </select>
                <div className="button-row">
                  <button className="btn btn-wallet" disabled={busy || proposalAccount === null} onClick={onApproveProposal}>
                    Connect
                  </button>
                  <button className="btn btn-wallet-secondary" onClick={onRejectProposal} disabled={busy}>
                    Reject
                  </button>
                </div>
              </>
            )}
          </div>
        ) : pendingSign !== undefined ? (
          <div className="connection-request">
            <div className="connection-heading">
              <span className="connection-icon hot">!</span>
              <div>
                <h5>Sign message</h5>
                <small>{pendingSign.account.name} · {shortMiddle(pendingSign.account.partyId, 14, 7)}</small>
              </div>
            </div>
            <details className="wallet-details mb-3">
              <summary>Message</summary>
              <pre className="mono small mt-2">{pendingSign.messageBase64}</pre>
            </details>
            <div className="button-row">
              <button className="btn btn-wallet" onClick={onApproveSign} disabled={busy}>Sign</button>
              <button className="btn btn-wallet-secondary" onClick={onRejectSign} disabled={busy}>Reject</button>
            </div>
          </div>
        ) : pendingExecute !== undefined ? (
          <div className="connection-request">
            <div className="connection-heading">
              <span className="connection-icon hot">!</span>
              <div>
                <h5>{commandSummary(pendingExecute.params)}</h5>
                <small>{pendingExecute.account.name} · {shortMiddle(pendingExecute.account.partyId, 14, 7)}</small>
              </div>
            </div>
            <details className="wallet-details mb-3">
              <summary>Command payload</summary>
              <pre className="mono small mt-2">{JSON.stringify(pendingExecute.params, null, 2)}</pre>
            </details>
            <div className="button-row">
              <button className="btn btn-wallet" onClick={onApproveExecute} disabled={busy}>Approve</button>
              <button className="btn btn-wallet-secondary" onClick={onRejectExecute} disabled={busy}>Reject</button>
            </div>
          </div>
        ) : extensionMode ? (
          <div className="wc-connect-card">
            <div className="wc-connect-body">
              <div className="wc-connected-row">
                <div className="wc-dapp-copy">
                  <strong>Browser extension mode</strong>
                  <small>Waiting for dApp requests from local browser tabs</small>
                </div>
              </div>
            </div>
          </div>
        ) : connectedSession !== undefined ? (
          <>
            <div className="wc-connect-card">
              <img className="wc-mark" src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
              <div className="wc-connect-body">
                <div className="wc-connected-row">
                  <div className="wc-dapp-copy">
                    <strong>{connectedSession.name}</strong>
                    <small>{connectedSession.url}</small>
                  </div>
                  <button
                    className="btn btn-wallet-secondary"
                    type="button"
                    onClick={() => { void onDisconnectDapp(connectedSession.topic) }}
                    disabled={busy}
                  >
                    Disconnect
                  </button>
                </div>
                {sessions.length > 1 && (
                  <div className="connected-extra">{sessions.length - 1} more active session{sessions.length === 2 ? '' : 's'}</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="wc-connect-card">
            <img className="wc-mark" src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
            <div className="wc-connect-body">
              <div className="wc-pair-row">
                <input
                  className="form-control mono"
                  value={pairingDraft}
                  onChange={event => setPairingDraft(event.target.value)}
                  placeholder="wc:..."
                />
                <button
                  className="btn btn-wallet"
                  type="button"
                  onClick={() => { void onPairDapp() }}
                  disabled={pairingBusy || pairingDraft.trim() === ''}
                >
                  {pairingBusy ? 'Pairing...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {settingsOpen && (
        <div className="popup-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <div className="settings-popup" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="popup-title-row">
              <h5>Settings</h5>
              <button className="link-action" type="button" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <ConnectionSettingsView />
          </div>
        </div>
      )}

      <section className="wallet-section">
        <div className="section-title-row">
          <h5>Transactions</h5>
          <span>{v.transactions.length}</span>
        </div>
        {visibleTxs.length === 0 ? (
          <div className="empty-history">Executed transactions will appear here.</div>
        ) : (
          <div className="tx-column-list">
            <div className="tx-column-header" aria-hidden="true">
              <span>txHash</span>
              <span>method</span>
              <span />
            </div>
            {visibleTxs.map(tx => (
              <details key={tx.id} className="tx-column-row">
                <summary className="tx-column-main">
                  <span className="tx-cell tx-hash mono" title={tx.preparedTransactionHash}>
                    {shortMiddle(tx.preparedTransactionHash, 10, 8)}
                  </span>
                  <span className="tx-cell tx-method" title={tx.method}>
                    {txMethodLabel(tx.method)}
                  </span>
                  <span className="tx-expand">
                    <span className="tx-expand-more">view more</span>
                    <span className="tx-expand-less">view less</span>
                  </span>
                </summary>
                <div className="tx-details">
                  <dl>
                    <dt>Summary</dt>
                    <dd>{tx.summary ?? 'Canton transaction'}</dd>
                    <dt>Account</dt>
                    <dd>{tx.accountName}</dd>
                    <dt>Time</dt>
                    <dd>{txTime(tx)}</dd>
                    {tx.commandCount !== undefined && (
                      <>
                        <dt>Commands</dt>
                        <dd>{tx.commandCount}</dd>
                      </>
                    )}
                    <dt>Network</dt>
                    <dd>{tx.network}</dd>
                    <dt>Party</dt>
                    <dd className="mono">{tx.partyId}</dd>
                    <dt>Method</dt>
                    <dd>{tx.method}</dd>
                    <dt>Prepared hash</dt>
                    <dd className="mono">{tx.preparedTransactionHash}</dd>
                    {tx.commandId !== undefined && (
                      <>
                        <dt>Command ID</dt>
                        <dd className="mono">{tx.commandId}</dd>
                      </>
                    )}
                    {tx.submissionId !== undefined && (
                      <>
                        <dt>Submission ID</dt>
                        <dd className="mono">{tx.submissionId}</dd>
                      </>
                    )}
                    {tx.updateId !== undefined && (
                      <>
                        <dt>Update ID</dt>
                        <dd className="mono">{tx.updateId}</dd>
                      </>
                    )}
                    {tx.completionOffset !== undefined && (
                      <>
                        <dt>Completion offset</dt>
                        <dd>{tx.completionOffset}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {!hasPending && accountsSorted.length > 0 && (
        <p className="locked-note text-center mb-0">Waiting for dApp requests.</p>
      )}
    </div>
  )
}
