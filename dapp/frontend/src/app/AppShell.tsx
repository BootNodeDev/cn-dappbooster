import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { FullScreenSpinner } from '@/components/Spinner'
import { useParty } from '@/wallet/hooks'
import { ConnectScreen } from './ConnectScreen'
import { TopBar } from './TopBar'

export const AppShell = (): React.JSX.Element => {
  const { isConnected, hydrated } = useParty()

  if (!hydrated) {
    return <FullScreenSpinner />
  }
  if (!isConnected) {
    return <ConnectScreen />
  }

  return (
    <div className="flex min-h-screen flex-col">
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
