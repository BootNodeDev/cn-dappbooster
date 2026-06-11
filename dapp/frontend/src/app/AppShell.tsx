import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useConnect, useParty, useWalletStatus } from '@/wallet/hooks'
import { readReconnect, writeReconnect } from '@/wallet/reconnect'
import { ConnectScreen } from './ConnectScreen'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const titleFor = (pathname: string): { title: string; crumb: string } => {
  if (pathname.startsWith('/proposals')) {
    return { title: 'Proposals', crumb: 'Incoming offers' }
  }
  if (pathname.startsWith('/create')) {
    return { title: 'Create grant', crumb: 'Funder' }
  }
  if (pathname.startsWith('/grants/')) {
    return { title: 'Grant detail', crumb: 'Grant' }
  }
  return { title: 'Dashboard', crumb: 'Your vesting' }
}

// Full-page state card used for the locked / no-account gates.
const GateCard = ({ title, body }: { title: string; body: string }): React.JSX.Element => (
  <div className="grid min-h-screen place-items-center bg-bg px-6">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-popover)]">
      <h1 className="text-lg font-extrabold text-fg">{title}</h1>
      <p className="mt-2 text-sm text-fg-muted">{body}</p>
    </div>
  </div>
)

export const AppShell = (): React.JSX.Element => {
  const { connect, isConnected } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const location = useLocation()

  // Seeded before first paint so a reload with a saved session shows a spinner,
  // not a flash of the landing.
  const [reconnecting, setReconnecting] = useState(() => readReconnect() === 'extension')
  const reconnectStarted = useRef(false)

  // Silently reconnect a prior Carpincho extension session on reload. Guarded
  // against StrictMode's double-invoke; WalletConnect is reconnected manually.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (isConnected || readReconnect() !== 'extension') {
      setReconnecting(false)
      return
    }
    if (reconnectStarted.current) {
      return
    }
    reconnectStarted.current = true
    void connect('extension')
      .catch(() => writeReconnect(null))
      .finally(() => setReconnecting(false))
  }, [])

  if (reconnecting && !isConnected) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex items-center gap-3 text-sm text-fg-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          Reconnecting your wallet…
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return <ConnectScreen />
  }

  if (isLocked) {
    return <GateCard title="Wallet locked" body="Unlock Carpincho to continue." />
  }

  if (party === undefined) {
    return (
      <GateCard title="No account selected" body="Select an account in Carpincho to continue." />
    )
  }

  const { title, crumb } = titleFor(location.pathname)

  return (
    <div className="flex min-h-screen" data-testid="workspace-ready">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} crumb={crumb} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
