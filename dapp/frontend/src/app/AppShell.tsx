import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { FullScreenSpinner } from '@/components/Spinner'
import { useConnect, useParty, useWalletStatus } from '@/wallet/hooks'
import { readReconnect, writeReconnect } from '@/wallet/reconnect'
import { ConnectScreen } from './ConnectScreen'
import { TopBar } from './TopBar'

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
    return <FullScreenSpinner />
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

  return (
    <div className="flex min-h-screen flex-col" data-testid="workspace-ready">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:border focus:border-primary focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
        <Suspense fallback={<FullScreenSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
