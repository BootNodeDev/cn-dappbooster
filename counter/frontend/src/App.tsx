import { AppHeader } from './features/counter/components/AppHeader.js'
import { CounterWorkspace } from './features/counter/components/CounterWorkspace.js'
import { StatusMessage } from './features/counter/components/StatusMessage.js'
import { useCounterWorkspace } from './features/counter/hooks/useCounterWorkspace.js'

export const App = (): JSX.Element => {
  const workspace = useCounterWorkspace()

  return (
    <main className="shell">
      <AppHeader
        networkConfig={workspace.networkConfig}
        connected={workspace.connected}
        busy={workspace.busy}
        pairingUri={workspace.pairingUri}
        pairingCopied={workspace.pairingCopied}
        onNetworkChange={workspace.onNetworkChange}
        onConnect={workspace.onConnect}
        onDisconnect={workspace.onDisconnect}
        onRefreshCounters={workspace.loadCounters}
        onCopyPairingUri={workspace.copyPairingUri}
        onCancelPairing={workspace.cancelPairing}
      />

      <StatusMessage kind="info" message={workspace.info} onDismiss={workspace.clearInfo} />
      <StatusMessage kind="error" message={workspace.error} onDismiss={workspace.clearError} />

      <CounterWorkspace
        connected={workspace.connected}
        counters={workspace.counters}
        busy={workspace.busy}
        partyDrafts={workspace.partyDrafts}
        onCreateCounter={workspace.createCounter}
        onIncrementCounter={workspace.incrementCounter}
        onAddUser={workspace.addUser}
        onAddViewer={workspace.addViewer}
        onDraftChange={workspace.updateDraft}
      />
    </main>
  )
}
