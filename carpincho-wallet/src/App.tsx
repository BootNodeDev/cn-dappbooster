import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { MenuSheet } from '@/components/menu/MenuSheet'
import { SPINNER_ICON } from '@/components/ui/icons'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useVault } from '@/vault/useVault'
import { VaultProvider } from '@/vault/VaultContext'
import { HomeView } from '@/views/HomeView'
import { OnboardingFlow } from '@/views/onboarding/OnboardingFlow'
import { UnlockView } from '@/views/UnlockView'

const Shell = (): JSX.Element => {
  const v = useVault()
  const [menuOpen, setMenuOpen] = useState(false)
  const showHeader = v.hasVault && !v.isLocked && v.accounts.length > 0
  useEffect(() => {
    if (!showHeader) setMenuOpen(false)
  }, [showHeader])
  if (v.isLoading) {
    return (
      <div className="w-popup mx-auto px-3 pt-3 pb-8 min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        {SPINNER_ICON}
        <p className="m-0 font-sans text-[0.95rem] font-medium">Loading...</p>
      </div>
    )
  }
  return (
    <div className={`w-popup mx-auto px-3 pt-3 ${showHeader ? 'pb-20' : 'pb-8'}`}>
      {showHeader && <Header onOpenMenu={() => setMenuOpen(true)} />}
      {v.hasVault && v.isLocked && <UnlockView />}
      {/* No vault yet: onboarding step 1 (create vault). */}
      {!v.hasVault && <OnboardingFlow />}
      {/* Unlocked vault with no account yet: onboarding step 2 (create first account). */}
      {v.hasVault && !v.isLocked && v.accounts.length === 0 && <OnboardingFlow />}
      {v.hasVault && !v.isLocked && v.accounts.length > 0 && <HomeView />}
      {showHeader && (
        <MenuSheet
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      )}
    </div>
  )
}

const App = (): JSX.Element => (
  <VaultProvider>
    <TooltipProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </TooltipProvider>
  </VaultProvider>
)

export default App
