import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useVault } from '../vault/useVault.js'
import { AddAccountView } from './AddAccountView.js'
import { ConnectionSettingsView } from './ConnectionSettingsView.js'
import {
  approveProposal,
  pairWithUri,
  rejectProposal,
  respondWithError,
  respondWithResult,
  respondWithSignMessage,
  subscribeToProposals,
  subscribeToRequests,
  type ProposalEvent,
  type RequestEvent,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE
} from '../wc/client.js'
import { dispatchRequest } from '../wc/handlers.js'
import type { AccountPublic, TransactionRecord } from '../vault/types.js'
import { walletServiceRequest } from '../api/walletService.js'

interface PendingSignRequest {
  req: RequestEvent
  account: AccountPublic
  messageBase64: string
}

interface PendingExecuteRequest {
  req: RequestEvent
  account: AccountPublic
  method: typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
  params: Record<string, unknown>
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

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [screen, setScreen] = useState<WalletScreen>('home')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [proposal, setProposal] = useState<ProposalEvent | undefined>(undefined)
  const [proposalAccount, setProposalAccount] = useState<string | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSignRequest | undefined>(undefined)
  const [pendingExecute, setPendingExecute] = useState<PendingExecuteRequest | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  // Strip ?wc= after pairing so a refresh does not try the same URI twice.
  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (proposal === undefined) {
      setProposalAccount(null)
      return
    }
    setProposalAccount(prev => prev ?? v.primary?.id ?? v.accounts[0]?.id ?? null)
  }, [proposal, v.primary, v.accounts])

  // Lazy so newly added accounts are visible to in-flight requests.
  const resolveAccounts = useCallback(() => ({
    accounts: v.accounts,
    primary: v.primary
  }), [v.accounts, v.primary])

  useEffect(() => {
    let unsubP: (() => void) | undefined
    let unsubR: (() => void) | undefined
    void (async () => {
      setError(undefined)
      unsubP = await subscribeToProposals(setProposal)
      unsubR = await subscribeToRequests(async (req) => {
        const result = await dispatchRequest(req, resolveAccounts)
        if (result.status === 'pending-approval' && result.pendingMethod === CANTON_METHOD_SIGN_MESSAGE) {
          const messageBase64 = (req.params.request.params as { message?: string })?.message
          if (typeof messageBase64 !== 'string') {
            await respondWithError(req.topic, req.id, -32602, 'message param missing')
            return
          }
          const account = v.primary ?? v.accounts[0]
          if (account === undefined) {
            await respondWithError(req.topic, req.id, -32000, 'no account available')
            return
          }
          setPendingSign({ req, account, messageBase64 })
        }
        if (
          result.status === 'pending-approval' &&
          (result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE || result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT)
        ) {
          const account = v.primary ?? v.accounts[0]
          if (account === undefined) {
            await respondWithError(req.topic, req.id, -32000, 'no account available')
            return
          }
          setPendingExecute({
            req,
            account,
            method: result.pendingMethod,
            params: executeParams(req.params.request.params, account.partyId)
          })
        }
      })
    })().catch((err: Error) => setError(`WalletConnect init failed: ${err.message}`))
    return () => {
      unsubP?.()
      unsubR?.()
    }
  }, [resolveAccounts, v.primary, v.accounts])

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
      await approveProposal({ proposalId: proposal.id, partyId: account.partyId })
      setInfo(`Connected to ${proposal.params.proposer.metadata.name}`)
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
      await respondWithSignMessage(pendingSign.req.topic, pendingSign.req.id, signature)
      setInfo('Signed.')
      setPendingSign(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await respondWithError(pendingSign.req.topic, pendingSign.req.id, -32000, msg).catch(() => undefined)
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
    await respondWithError(pendingSign.req.topic, pendingSign.req.id, 4001, 'user rejected').catch(() => undefined)
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
      const isLegacyPrepareSign = pendingExecute.req.params.request.method === 'canton_prepareSignExecute'
      const result =
        pendingExecute.method === CANTON_METHOD_PREPARE_EXECUTE
          ? null
          : isLegacyPrepareSign ? tx : { tx }
      await respondWithResult(pendingExecute.req.topic, pendingExecute.req.id, result)
      setInfo('Transaction executed.')
      setPendingExecute(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await respondWithError(pendingExecute.req.topic, pendingExecute.req.id, -32000, msg).catch(() => undefined)
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
    await respondWithError(pendingExecute.req.topic, pendingExecute.req.id, 4001, 'user rejected').catch(() => undefined)
    setPendingExecute(undefined)
  }

  const accountsSorted = useMemo(
    () => [...v.accounts].sort((a, b) => (a.isPrimary === b.isPrimary ? a.createdAt - b.createdAt : a.isPrimary ? -1 : 1)),
    [v.accounts]
  )
  const primary = v.primary ?? accountsSorted[0]
  const visibleTxs = v.transactions.slice(0, 8)
  const hasPending = proposal !== undefined || pendingSign !== undefined || pendingExecute !== undefined

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
          <span className={`status-dot ${hasPending ? 'hot' : ''}`}>{hasPending ? 'Action needed' : 'Ready'}</span>
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
              <button className="account-add-button" type="button" onClick={() => setScreen('add-account')}>
                Add
              </button>
            </div>
          </>
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

      {proposal !== undefined && (
        <section className="request-panel mb-3">
          <div className="request-kicker">Connection request</div>
          <h5>{proposal.params.proposer.metadata.name}</h5>
          <p>Choose the account this dApp can see.</p>
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
        </section>
      )}

      {pendingSign !== undefined && (
        <section className="request-panel mb-3">
          <div className="request-kicker">Signature request</div>
          <h5>{pendingSign.account.name}</h5>
          <p className="mono tiny">{shortMiddle(pendingSign.account.partyId, 18, 10)}</p>
          <details className="wallet-details mb-3">
            <summary>Message</summary>
            <pre className="mono small mt-2">{pendingSign.messageBase64}</pre>
          </details>
          <div className="button-row">
            <button className="btn btn-wallet" onClick={onApproveSign} disabled={busy}>Sign</button>
            <button className="btn btn-wallet-secondary" onClick={onRejectSign} disabled={busy}>Reject</button>
          </div>
        </section>
      )}

      {pendingExecute !== undefined && (
        <section className="request-panel mb-3">
          <div className="request-kicker">Transaction request</div>
          <h5>{commandSummary(pendingExecute.params)}</h5>
          <p>
            Executing as <strong>{pendingExecute.account.name}</strong>
            <span className="mono tiny d-block">{shortMiddle(pendingExecute.account.partyId, 18, 10)}</span>
          </p>
          <details className="wallet-details mb-3">
            <summary>Command payload</summary>
            <pre className="mono small mt-2">{JSON.stringify(pendingExecute.params, null, 2)}</pre>
          </details>
          <div className="button-row">
            <button className="btn btn-wallet" onClick={onApproveExecute} disabled={busy}>Approve</button>
            <button className="btn btn-wallet-secondary" onClick={onRejectExecute} disabled={busy}>Reject</button>
          </div>
        </section>
      )}

      <section className="wallet-section">
        <div className="section-title-row">
          <h5>Transactions</h5>
          <span>{v.transactions.length}</span>
        </div>
        {visibleTxs.length === 0 ? (
          <div className="empty-history">Executed transactions will appear here.</div>
        ) : (
          <div className="tx-list">
            {visibleTxs.map(tx => (
              <article key={tx.id} className="tx-row">
                <div className="tx-icon">OK</div>
                <div className="tx-main">
                  <div className="tx-title">{tx.summary ?? 'Canton transaction'}</div>
                  <div className="tx-meta">
                    {tx.accountName} · {txTime(tx)}
                    {tx.commandCount !== undefined && ` · ${tx.commandCount} cmd${tx.commandCount === 1 ? '' : 's'}`}
                  </div>
                  <div className="tx-hash mono" title={tx.preparedTransactionHash}>
                    {shortMiddle(tx.preparedTransactionHash, 18, 10)}
                  </div>
                </div>
                <div className="tx-status">Done</div>
              </article>
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
