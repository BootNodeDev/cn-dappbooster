import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountCard } from '@/components/AccountCard'
import { ActivityList } from '@/components/ActivityList'
import { ConnectionFooter } from '@/components/ConnectionFooter'
import { PairOrConnectedCard } from '@/components/PairOrConnectedCard'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/toast'
import { useExtensionDappConnection } from '@/extension/dappConnection'
import { isExtensionRuntime } from '@/extension/runtimeClient'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus'
import { sortAccounts } from '@/utils/account'
import { cn } from '@/utils/cn'
import { useVault } from '@/vault/useVault'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView'
import { PendingActionsSection } from '@/views/home/PendingActionsSection'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types'
import { useExtensionRequests } from '@/views/home/useExtensionRequests'
import { usePendingActions } from '@/views/home/usePendingActions'
import { useProviderRequestHandler } from '@/views/home/useProviderRequestHandler'
import { useWalletConnectLifecycle } from '@/views/home/useWalletConnectLifecycle'
import type { AccountSnapshot } from '@/wc/accounts'
import {
  type ConnectedDappSession,
  disconnectSession,
  getConnectedDappSessions,
  type ProposalEvent,
  pairWithUri,
} from '@/wc/client'

export const HomeView = (): JSX.Element => {
  const v = useVault()
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
  const extensionMode = isExtensionRuntime()
  const walletService = useWalletServiceStatus()

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

  const handleProviderRequest = useProviderRequestHandler(
    resolveAccounts,
    setPendingSign,
    setPendingExecute,
  )

  useWalletConnectLifecycle({ extensionMode, handleProviderRequest, setSessions, setProposal })
  useExtensionRequests({ extensionMode, handleProviderRequest })

  const pendingActions = usePendingActions({
    vault: v,
    proposal,
    proposalAccount,
    pendingSign,
    pendingExecute,
    setProposal,
    setPendingSign,
    setPendingExecute,
    setBusy,
    refreshSessions,
    closeExtensionPopup,
  })

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

  const accountsSorted = useMemo(() => sortAccounts(v.accounts), [v.accounts])
  // HomeView only renders when an account exists (onboarding owns the empty state and the
  // last account cannot be removed), so a primary account is always available.
  const primary = v.primary ?? accountsSorted[0]
  const hasPending =
    proposal !== undefined || pendingSign !== undefined || pendingExecute !== undefined
  const dapp = useExtensionDappConnection({
    extensionMode,
    sessions,
  })

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 pb-2',
          hasPending && 'h-[calc(100vh-12rem)] min-h-0 overflow-hidden pb-0',
        )}
      >
        <AccountCard primary={primary} />

        {hasPending && (
          <PendingActionsSection
            proposal={proposal}
            pendingSign={pendingSign}
            pendingExecute={pendingExecute}
            proposalAccount={proposalAccount}
            onProposalAccountChange={setProposalAccount}
            accountsSorted={accountsSorted}
            busy={busy}
            {...pendingActions}
          />
        )}

        {!hasPending && !extensionMode && (
          <PairOrConnectedCard
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

        {!hasPending && <ActivityList transactions={v.transactions} />}
      </div>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Connection"
        description="Configure wallet-service URL and network."
      >
        <ConnectionSettingsView />
      </Sheet>

      <ConnectionFooter
        walletService={walletService}
        dapp={dapp}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </>
  )
}
