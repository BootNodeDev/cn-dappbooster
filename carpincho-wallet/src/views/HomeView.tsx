import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { walletServiceRequest } from '@/api/walletService.ts'
import { AccountCard } from '@/components/AccountCard.tsx'
import { ActivityList } from '@/components/ActivityList.tsx'
import { ConnectionFooter, type ConnectionTone } from '@/components/ConnectionFooter.tsx'
import { PairOrConnectedCard } from '@/components/PairOrConnectedCard.tsx'
import { Alert } from '@/components/ui/Alert.tsx'
import { CARD_CLASS } from '@/components/ui/Card.tsx'
import { PendingActionCard } from '@/components/ui/PendingActionCard.tsx'
import { Select, SelectItem } from '@/components/ui/Select.tsx'
import { Sheet } from '@/components/ui/Sheet.tsx'
import { toast } from '@/components/ui/toast.ts'
import type { RuntimePendingRequest } from '@/extension/messages.ts'
import {
  createRuntimeResponder,
  getPendingProviderRequests,
  isExtensionRuntime,
  subscribeToPendingProviderRequests,
} from '@/extension/runtimeClient.ts'
import {
  dispatchProviderRequest,
  type ProviderRequest,
  type ProviderResponder,
} from '@/provider/dispatch.ts'
import { shortMiddle } from '@/utils/account.ts'
import { cn } from '@/utils/cn.ts'
import type { AccountPublic } from '@/vault/types.ts'
import { useVault } from '@/vault/useVault.ts'
import { AddAccountView } from '@/views/AddAccountView.tsx'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView.tsx'
import { type AccountSnapshot, selectedAccount } from '@/wc/accounts.ts'
import {
  approveProposal,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE,
  type ConnectedDappSession,
  disconnectSession,
  getConnectedDappSessions,
  type ProposalEvent,
  pairWithUri,
  type RequestEvent,
  rejectProposal,
  respondWithError,
  respondWithResult,
  subscribeToProposals,
  subscribeToRequests,
  subscribeToSessionChanges,
} from '@/wc/client.ts'

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
  hashingSchemeVersion:
    | 'HASHING_SCHEME_VERSION_UNSPECIFIED'
    | 'HASHING_SCHEME_VERSION_V2'
    | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
}

interface ExecutePreparedResponse {
  updateId?: string
  completionOffset?: number
}

const executeParams = (params: unknown, partyId: string): Record<string, unknown> => {
  const base =
    typeof params === 'object' && params !== null && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {}
  const actAs = Array.isArray(base.actAs) && base.actAs.length > 0 ? base.actAs : [partyId]
  return {
    ...base,
    partyId,
    actAs,
    readAs: Array.isArray(base.readAs) ? base.readAs : actAs,
  }
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

const walletConnectResponder = (req: RequestEvent): ProviderResponder => ({
  result: async (value) => {
    await respondWithResult(req.topic, req.id, value)
  },
  error: async (code, message) => {
    await respondWithError(req.topic, req.id, code, message)
  },
})

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pairingDraft, setPairingDraft] = useState('')
  const [pairingBusy, setPairingBusy] = useState(false)
  const [sessions, setSessions] = useState<ConnectedDappSession[]>([])
  const [proposal, setProposal] = useState<ProposalEvent | undefined>(undefined)
  const [proposalAccount, setProposalAccount] = useState<string | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSignRequest | undefined>(undefined)
  const [pendingExecute, setPendingExecute] = useState<PendingExecuteRequest | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const accountSnapshotRef = useRef<AccountSnapshot>({ accounts: v.accounts, primary: v.primary })
  const seenExtensionRequests = useRef<Set<string>>(new Set())
  const extensionMode = isExtensionRuntime()

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
      .catch((err: Error) => toast.error(`Pair failed: ${err.message}`))
  }, [extensionMode])

  useEffect(() => {
    if (proposal === undefined) {
      setProposalAccount(null)
      return
    }
    setProposalAccount((prev) => prev ?? v.primary?.id ?? v.accounts[0]?.id ?? null)
  }, [proposal, v.primary, v.accounts])

  useEffect(() => {
    accountSnapshotRef.current = { accounts: v.accounts, primary: v.primary }
  }, [v.accounts, v.primary])

  const closeExtensionPopup = useCallback((): void => {
    if (!extensionMode) {
      return
    }
    window.close()
  }, [extensionMode])

  const resolveAccounts = useCallback(
    () => ({
      accounts: accountSnapshotRef.current.accounts,
      primary: accountSnapshotRef.current.primary,
    }),
    [],
  )

  const refreshSessions = useCallback(async (): Promise<void> => {
    setSessions(await getConnectedDappSessions())
  }, [])

  const handleProviderRequest = useCallback(
    async (
      request: ProviderRequest,
      responder: ProviderResponder,
      context: { label: string; rawMethod?: string },
    ): Promise<void> => {
      const result = await dispatchProviderRequest(request, resolveAccounts, responder)
      if (
        result.status === 'pending-approval' &&
        result.pendingMethod === CANTON_METHOD_SIGN_MESSAGE
      ) {
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
        (result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE ||
          result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT)
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
          responder,
        })
      }
    },
    [resolveAccounts],
  )

  const handleExtensionPending = useCallback(
    async (pending: RuntimePendingRequest): Promise<void> => {
      if (seenExtensionRequests.current.has(pending.requestId)) {
        return
      }
      seenExtensionRequests.current.add(pending.requestId)
      try {
        await handleProviderRequest(
          {
            method: pending.request.method,
            params: pending.request.params,
          },
          createRuntimeResponder(pending),
          { label: pending.origin },
        )
      } catch (error) {
        console.error('[carpincho:extension] request handler failed', { pending, error })
        toast.error(`Extension request failed: ${(error as Error).message}`)
      }
    },
    [handleProviderRequest],
  )

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsub: (() => void) | undefined
    void subscribeToSessionChanges(setSessions)
      .then((fn) => {
        unsub = fn
      })
      .catch((err: Error) => toast.error(`WalletConnect sessions failed: ${err.message}`))
    return () => {
      unsub?.()
    }
  }, [extensionMode])

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsubP: (() => void) | undefined
    let unsubR: (() => void) | undefined
    void (async () => {
      unsubP = await subscribeToProposals(setProposal)
      unsubR = await subscribeToRequests(async (req) => {
        try {
          await handleProviderRequest(
            {
              method: req.params.request.method,
              params: req.params.request.params,
            },
            walletConnectResponder(req),
            { label: 'WalletConnect', rawMethod: req.params.request.method },
          )
        } catch (error) {
          console.error('[carpincho:wc] request handler failed', { req, error })
          toast.error(`WalletConnect request failed: ${(error as Error).message}`)
        }
      })
    })().catch((err: Error) => toast.error(`WalletConnect init failed: ${err.message}`))
    return () => {
      unsubP?.()
      unsubR?.()
    }
  }, [extensionMode, handleProviderRequest])

  useEffect(() => {
    if (!extensionMode) {
      return
    }
    const unsubscribe = subscribeToPendingProviderRequests((pending) => {
      void handleExtensionPending(pending)
    })
    void getPendingProviderRequests()
      .then((pendingRequests) => {
        for (const pending of pendingRequests) {
          void handleExtensionPending(pending)
        }
      })
      .catch((err: Error) => toast.error(`Extension requests failed: ${err.message}`))
    return unsubscribe
  }, [extensionMode, handleExtensionPending])

  const onApproveProposal = async (): Promise<void> => {
    if (proposal === undefined || proposalAccount === null) {
      return
    }
    const account = v.accounts.find((a) => a.id === proposalAccount)
    if (account === undefined) {
      toast.error('Select an account first.')
      return
    }
    setBusy(true)
    try {
      await approveProposal({ proposal, partyId: account.partyId })
      await refreshSessions()
      setProposal(undefined)
      closeExtensionPopup()
    } catch (err) {
      toast.error(`Approve failed: ${(err as Error).message}`)
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
    closeExtensionPopup()
  }

  const onApproveSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    setBusy(true)
    try {
      const signature = await v.signMessage(pendingSign.account.id, pendingSign.messageBase64)
      await pendingSign.responder.result({ signature })
      toast.success('Signed.')
      setPendingSign(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingSign.responder.error(-32000, msg).catch(() => undefined)
      toast.error(`Sign failed: ${msg}`)
      setPendingSign(undefined)
    } finally {
      setBusy(false)
      closeExtensionPopup()
    }
  }

  const onRejectSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    await pendingSign.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingSign(undefined)
    closeExtensionPopup()
  }

  const onApproveExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    setBusy(true)
    try {
      const prepared = await walletServiceRequest<PreparedTransactionResponse>(
        'prepareTransaction',
        pendingExecute.params,
      )
      const signatureBase64 = await v.signMessage(
        pendingExecute.account.id,
        prepared.preparedTransactionHash,
      )
      const executed = await walletServiceRequest<ExecutePreparedResponse>('executePrepared', {
        ...prepared,
        partyId: pendingExecute.account.partyId,
        signatureBase64,
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
        summary: commandSummary(pendingExecute.params),
      })

      const tx = {
        status: 'executed',
        commandId: optionalString(pendingExecute.params.commandId) ?? '',
        payload: {
          updateId: executed.updateId ?? '',
          completionOffset: executed.completionOffset ?? 0,
        },
      }
      const isLegacyPrepareSign = pendingExecute.rawMethod === 'canton_prepareSignExecute'
      const result =
        pendingExecute.method === CANTON_METHOD_PREPARE_EXECUTE
          ? null
          : isLegacyPrepareSign
            ? tx
            : { tx }
      await pendingExecute.responder.result(result)
      toast.success('Transaction executed.')
      setPendingExecute(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingExecute.responder.error(-32000, msg).catch(() => undefined)
      toast.error(`Transaction failed: ${msg}`)
      setPendingExecute(undefined)
    } finally {
      setBusy(false)
      closeExtensionPopup()
    }
  }

  const onRejectExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    await pendingExecute.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingExecute(undefined)
    closeExtensionPopup()
  }

  const onPairDapp = async (): Promise<void> => {
    const uri = pairingDraft.trim()
    if (uri === '') {
      toast.warning('Paste a WalletConnect pairing URI first.')
      return
    }
    setPairingBusy(true)
    try {
      await pairWithUri(uri)
      setPairingDraft('')
    } catch (err) {
      toast.error(`Pairing failed: ${(err as Error).message}`)
    } finally {
      setPairingBusy(false)
    }
  }

  const onDisconnectDapp = async (topic: string): Promise<void> => {
    setBusy(true)
    try {
      await disconnectSession(topic)
      await refreshSessions()
    } catch (err) {
      toast.error(`Disconnect failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const onCopyPartyId = (partyId: string): void => {
    void navigator.clipboard
      .writeText(partyId)
      .then(() => toast.success('Party ID copied'))
      .catch((err: Error) => toast.error(`Copy failed: ${err.message}`))
  }

  const accountsSorted = useMemo(
    () =>
      [...v.accounts].sort((a, b) =>
        a.isPrimary === b.isPrimary ? a.createdAt - b.createdAt : a.isPrimary ? -1 : 1,
      ),
    [v.accounts],
  )
  // Without an account there is no Canton party available for dApp listening or activity history.
  const hasAccounts = accountsSorted.length > 0
  const primary = v.primary ?? accountsSorted[0]
  const hasPending =
    proposal !== undefined || pendingSign !== undefined || pendingExecute !== undefined
  const hasSession = sessions[0] !== undefined
  const { tone: connectionTone, label: connectionLabel }: { tone: ConnectionTone; label: string } =
    extensionMode
      ? { tone: 'muted', label: 'extension' }
      : hasSession
        ? {
            tone: 'good',
            label: `${sessions.length} dApp${sessions.length === 1 ? '' : 's'} connected`,
          }
        : { tone: 'warn', label: 'no dApps connected' }

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 pb-2',
          !hasAccounts && 'min-h-[calc(100vh-10rem)] justify-center',
        )}
      >
        <AccountCard
          primary={primary}
          accountsSorted={accountsSorted}
          onSelectAccount={(id) => {
            void v.setPrimary(id)
          }}
          onAddAccount={() => setAddAccountOpen(true)}
          onCopyPartyId={onCopyPartyId}
        />

        {hasAccounts && hasPending && (
          <section className={cn(CARD_CLASS, 'p-4 border-success/55 animate-soft-pulse')}>
            {proposal !== undefined ? (
              <PendingActionCard
                title="Connection request"
                subtitle={`${proposal.params.proposer.metadata.name} wants to pair`}
                approveLabel="Connect"
                approveDisabled={busy || proposalAccount === null}
                onApprove={onApproveProposal}
                onReject={onRejectProposal}
                busy={busy}
              >
                {accountsSorted.length === 0 ? (
                  <Alert variant="info">Add an account first before approving.</Alert>
                ) : (
                  <>
                    <label
                      className="inline-block mb-2 text-sm"
                      htmlFor="proposal-account-select"
                    >
                      Account
                    </label>
                    <Select
                      id="proposal-account-select"
                      className="mb-2"
                      value={proposalAccount ?? ''}
                      onValueChange={setProposalAccount}
                    >
                      {accountsSorted.map((a) => (
                        <SelectItem
                          key={a.id}
                          value={a.id}
                        >
                          {a.name} · {shortMiddle(a.partyId, 12, 6)}
                        </SelectItem>
                      ))}
                    </Select>
                  </>
                )}
              </PendingActionCard>
            ) : pendingSign !== undefined ? (
              <PendingActionCard
                title="Sign message"
                subtitle={`${pendingSign.account.name} · ${shortMiddle(pendingSign.account.partyId, 14, 7)}`}
                approveLabel="Sign"
                onApprove={onApproveSign}
                onReject={onRejectSign}
                busy={busy}
                payload={{ summary: 'Message', json: pendingSign.messageBase64 }}
              />
            ) : pendingExecute !== undefined ? (
              <PendingActionCard
                title={commandSummary(pendingExecute.params)}
                subtitle={`${pendingExecute.account.name} · ${shortMiddle(pendingExecute.account.partyId, 14, 7)}`}
                approveLabel="Approve"
                onApprove={onApproveExecute}
                onReject={onRejectExecute}
                busy={busy}
                payload={{ summary: 'Command payload', json: pendingExecute.params }}
              />
            ) : null}
          </section>
        )}

        {hasAccounts && !hasPending && (
          <PairOrConnectedCard
            extensionMode={extensionMode}
            sessions={sessions}
            pairingDraft={pairingDraft}
            pairingBusy={pairingBusy}
            busy={busy}
            onPairingDraftChange={setPairingDraft}
            onPair={() => {
              void onPairDapp()
            }}
            onDisconnect={(topic) => {
              void onDisconnectDapp(topic)
            }}
          />
        )}

        {hasAccounts && <ActivityList transactions={v.transactions} />}
      </div>

      <Sheet
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        title="Add account"
        description="Generate a new Canton party and store its keypair locally."
      >
        <AddAccountView onClose={() => setAddAccountOpen(false)} />
      </Sheet>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Connection"
        description="Configure wallet-service URL and network."
      >
        <ConnectionSettingsView />
      </Sheet>

      <ConnectionFooter
        tone={connectionTone}
        label={connectionLabel}
        onEdit={() => setSettingsOpen(true)}
      />
    </>
  )
}
