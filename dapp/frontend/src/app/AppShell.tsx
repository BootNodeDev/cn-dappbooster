import { Outlet } from 'react-router-dom'
import { useParty } from '@/wallet/hooks'
import { ConnectScreen } from './ConnectScreen'
import { Footer } from './Footer'
import { TopBar } from './TopBar'

export const AppShell = (): React.JSX.Element => {
  const { isConnected } = useParty()

  if (!isConnected) {
    return <ConnectScreen />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
