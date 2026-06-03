import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountCard } from '@/components/AccountCard'
import { ConnectionFooter } from '@/components/ConnectionFooter'
import { HomeTabs } from '@/components/HomeTabs'
import { PrimaryButton } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/toast'
import { useExtensionDappConnection } from '@/extension/dappConnection'
import { forgetConnectedOrigin, isExtensionRuntime } from '@/extension/runtimeClient'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus'
import { shortMiddle, sortAccounts } from '@/utils/account'
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
} from '@/wc/client'

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
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
  const connectedSession = sessions[0]
  // The footer shows the connected account's address (truncated party id), matching the header: the
  // WC session's account on the web, the active account for the extension's injected provider.
  const footerDappAccountAddress = ((): string | undefined => {
    if (extensionMode) {
      return primary === undefined ? undefined : shortMiddle(primary.partyId, 12, 7)
    }
    if (connectedSession === undefined) {
      return undefined
    }
    const partyId =
      v.accounts.find((a) => connectedSession.accounts.includes(a.partyId))?.partyId ??
      connectedSession.accounts[0]
    return partyId === undefined ? undefined : shortMiddle(partyId, 12, 7)
  })()
  // The actual disconnect, run only after the confirmation dialog is accepted.
  const performDisconnect = ((): (() => void) | undefined => {
    if (extensionMode) {
      if (dapp.kind !== 'connected') {
        return undefined
      }
      const { origin } = dapp
      return () => {
        void forgetConnectedOrigin(origin).catch((err: Error) =>
          toast.error(`Disconnect failed: ${err.message}`),
        )
      }
    }
    return connectedSession === undefined
      ? undefined
      : () => {
          void onDisconnectDapp(connectedSession.topic)
        }
  })()
  const connectedLabel = dapp.kind === 'connected' ? dapp.label : ''
  const connectedOrigin = dapp.kind === 'connected' ? dapp.origin : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-3">
        <AccountCard primary={primary} />
      </div>

      <HomeTabs transactions={v.transactions} />

      {/* Approval requests are modal: the request must be explicitly approved or rejected, so the
          dialog has no dismiss affordance (onOpenChange is ignored, close X hidden). */}
      <Sheet
        open={hasPending}
        onOpenChange={() => undefined}
        side="center"
        title="Awaiting approval"
        description="Review and approve or reject this dApp request."
        hideClose
      >
        <PendingActionsSection
          proposal={proposal}
          pendingSign={pendingSign}
          pendingExecute={pendingExecute}
          proposalAccount={proposalAccount}
          accountsSorted={accountsSorted}
          busy={busy}
          {...pendingActions}
        />
      </Sheet>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Connection"
        description="Configure wallet-service URL and network."
      >
        <ConnectionSettingsView />
      </Sheet>

      <Sheet
        open={disconnectConfirmOpen}
        onOpenChange={setDisconnectConfirmOpen}
        side="center"
        title={`Disconnect ${connectedLabel}?`}
        description="Disconnect this dApp from the wallet."
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2.5">
            <span className="block break-all font-mono text-[0.8rem] leading-relaxed text-foreground">
              {connectedOrigin}
            </span>
          </div>
          <p className="text-soft text-[0.95rem] leading-relaxed">
            <span className="font-semibold text-foreground">{connectedLabel}</span> will be
            disconnected from this wallet.
          </p>
          <PrimaryButton
            className="w-full border-danger bg-danger enabled:hover:border-danger enabled:hover:shadow-none enabled:hover:before:opacity-0"
            data-testid="confirm-disconnect"
            onClick={() => {
              performDisconnect?.()
              setDisconnectConfirmOpen(false)
            }}
          >
            Disconnect
          </PrimaryButton>
        </div>
      </Sheet>

      <ConnectionFooter
        walletService={walletService}
        dapp={dapp}
        dappAccountAddress={footerDappAccountAddress}
        onDisconnectDapp={
          performDisconnect === undefined ? undefined : () => setDisconnectConfirmOpen(true)
        }
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  )
}
