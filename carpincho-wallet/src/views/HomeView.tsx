import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { AccountPublic } from '../vault/types.js'
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

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [showAdd, setShowAdd] = useState(false)
  const [proposal, setProposal] = useState<ProposalEvent | undefined>(undefined)
  const [proposalAccount, setProposalAccount] = useState<string | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSignRequest | undefined>(undefined)
  const [pendingExecute, setPendingExecute] = useState<PendingExecuteRequest | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  // Strip ?wc= after pairing so a refresh doesn't try the same URI twice.
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
      const tx = {
        status: 'executed',
        commandId: typeof pendingExecute.params.commandId === 'string' ? pendingExecute.params.commandId : '',
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

  return (
    <div>
      {info !== undefined && <div className="info-box mb-3">{info}</div>}
      {error !== undefined && <div className="error-box mb-3">{error}</div>}

      <ConnectionSettingsView />

      {proposal !== undefined && (
        <section className="card-soft mb-3">
          <h5 className="mb-2">Connection request</h5>
          <p className="mb-2">
            <strong>{proposal.params.proposer.metadata.name}</strong>
            {' '}wants to connect.
          </p>
          {accountsSorted.length === 0 ? (
            <div className="info-box">Add an account first before approving.</div>
          ) : (
            <>
              <label className="form-label small">Pair with account</label>
              <select
                className="form-select mb-2"
                value={proposalAccount ?? ''}
                onChange={e => setProposalAccount(e.target.value)}
              >
                {accountsSorted.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.partyId.slice(0, 18)}…
                  </option>
                ))}
              </select>
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-arg" disabled={busy || proposalAccount === null} onClick={onApproveProposal}>
                  Approve
                </button>
                <button className="btn btn-outline-secondary" onClick={onRejectProposal} disabled={busy}>
                  Reject
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {pendingSign !== undefined && (
        <section className="card-soft mb-3">
          <h5 className="mb-2">Signature request</h5>
          <p className="mb-2">
            Signing as <strong>{pendingSign.account.name}</strong> ·{' '}
            <span className="mono">{pendingSign.account.partyId.slice(0, 18)}…</span>
          </p>
          <details className="mb-2">
            <summary>Message (base64)</summary>
            <pre className="mono small mt-2" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
              {pendingSign.messageBase64}
            </pre>
          </details>
          <div className="d-flex gap-2">
            <button className="btn btn-arg" onClick={onApproveSign} disabled={busy}>Approve &amp; sign</button>
            <button className="btn btn-outline-secondary" onClick={onRejectSign} disabled={busy}>Reject</button>
          </div>
        </section>
      )}

      {pendingExecute !== undefined && (
        <section className="card-soft mb-3">
          <h5 className="mb-2">Transaction request</h5>
          <p className="mb-2">
            Executing as <strong>{pendingExecute.account.name}</strong> ·{' '}
            <span className="mono">{pendingExecute.account.partyId.slice(0, 18)}…</span>
          </p>
          <details className="mb-2" open>
            <summary>Command payload</summary>
            <pre className="mono small mt-2" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(pendingExecute.params, null, 2)}
            </pre>
          </details>
          <div className="d-flex gap-2">
            <button className="btn btn-arg" onClick={onApproveExecute} disabled={busy}>Approve &amp; execute</button>
            <button className="btn btn-outline-secondary" onClick={onRejectExecute} disabled={busy}>Reject</button>
          </div>
        </section>
      )}

      <section className="mb-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="mb-0">Accounts</h5>
          <button className="btn btn-arg btn-sm" onClick={() => setShowAdd(true)} disabled={showAdd}>
            + Add account
          </button>
        </div>
        {showAdd && <AddAccountView onClose={() => setShowAdd(false)} />}
        {accountsSorted.length === 0 && !showAdd && (
          <div className="info-box">No accounts yet. Click <em>Add account</em> to onboard one.</div>
        )}
        {accountsSorted.map(a => (
          <div key={a.id} className={`account-row ${a.isPrimary ? 'primary' : ''}`}>
            <div className="name">
              <span>{a.name}</span>
              {a.isPrimary && <span className="badge bg-info">primary</span>}
            </div>
            <div className="partyId">{a.partyId}</div>
            <div className="actions">
              {!a.isPrimary && (
                <button className="btn btn-link btn-sm p-0" onClick={() => { void v.setPrimary(a.id) }}>
                  Make primary
                </button>
              )}
              <button
                className="btn btn-link btn-sm p-0 text-danger"
                onClick={() => {
                  const ok = window.confirm(`Remove ${a.name}? The party stays on the participant; only this device's key is wiped.`)
                  if (ok) {
                    void v.removeAccount(a.id)
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>

      {proposal === undefined && pendingSign === undefined && pendingExecute === undefined && accountsSorted.length > 0 && (
        <p className="locked-note text-center">Waiting for connection requests from a dApp.</p>
      )}
    </div>
  )
}
