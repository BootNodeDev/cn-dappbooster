import { Outlet, useLocation } from 'react-router-dom'
import { useParty } from '@/wallet/hooks'
import { ConnectScreen } from './ConnectScreen'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const titleFor = (pathname: string): string => {
  if (pathname.startsWith('/proposals')) {
    return 'Proposals'
  }
  if (pathname.startsWith('/create')) {
    return 'Create escrow'
  }
  if (pathname.startsWith('/grants/')) {
    return 'Escrow detail'
  }
  return 'Dashboard'
}

export const AppShell = (): React.JSX.Element => {
  const { isConnected } = useParty()
  const location = useLocation()

  if (!isConnected) {
    return <ConnectScreen />
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(location.pathname)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
