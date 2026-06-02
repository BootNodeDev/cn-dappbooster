import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountCard } from '@/components/AccountCard.tsx'
import { ActivityList } from '@/components/ActivityList.tsx'
import { ConnectionFooter } from '@/components/ConnectionFooter.tsx'
import { PairOrConnectedCard } from '@/components/PairOrConnectedCard.tsx'
import { Sheet } from '@/components/ui/Sheet.tsx'
import { toast } from '@/components/ui/toast.ts'
import { useExtensionDappConnection } from '@/extension/dappConnection.ts'
import { isExtensionRuntime } from '@/extension/runtimeClient.ts'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus.ts'
import { cn } from '@/utils/cn.ts'
import { useVault } from '@/vault/useVault.ts'
import { AddAccountView } from '@/views/AddAccountView.tsx'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView.tsx'
import { PendingActionsSection } from '@/views/home/PendingActionsSection.tsx'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types.ts'
import { useExtensionRequests } from '@/views/home/useExtensionRequests.ts'
import { usePendingActions } from '@/views/home/usePendingActions.ts'
import { useProviderRequestHandler } from '@/views/home/useProviderRequestHandler.ts'
import { useWalletConnectLifecycle } from '@/views/home/useWalletConnectLifecycle.ts'
import type { AccountSnapshot } from '@/wc/accounts.ts'
import {
  type ConnectedDappSession,
  disconnectSession,
  getConnectedDappSessions,
  type ProposalEvent,
  pairWithUri,
} from '@/wc/client.ts'

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
  // Without an account there is no Canton party available for approvals or activity history.
  const hasAccounts = accountsSorted.length > 0
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
          !hasAccounts && 'min-h-[calc(100vh-10rem)] justify-center',
          hasAccounts && hasPending && 'h-[calc(100vh-12rem)] min-h-0 overflow-hidden pb-0',
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

        {hasAccounts && !hasPending && !extensionMode && (
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

        {hasAccounts && !hasPending && <ActivityList transactions={v.transactions} />}
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
        walletService={walletService}
        dapp={dapp}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </>
  )
}
