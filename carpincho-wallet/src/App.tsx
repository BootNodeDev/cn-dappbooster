import { VaultProvider } from './vault/VaultContext.js'
import { useVault } from './vault/useVault.js'
import { Header } from './components/Header.js'
import { SetupView } from './views/SetupView.js'
import { UnlockView } from './views/UnlockView.js'
import { HomeView } from './views/HomeView.js'

const Shell = (): JSX.Element => {
  const v = useVault()
  if (!v.hasVault) {
    return <SetupView />
  }
  if (v.isLocked) {
    return <UnlockView />
  }
  return (
    <div className="app-shell">
      <Header />
      <HomeView />
    </div>
  )
}

const App = (): JSX.Element => (
  <VaultProvider>
    <Shell />
  </VaultProvider>
)

export default App
