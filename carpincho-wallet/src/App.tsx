import { useEffect, useState } from 'react'
import { Header } from '@/components/Header.tsx'
import { MenuSheet } from '@/components/MenuSheet.tsx'
import { ThemeToggle } from '@/components/ThemeToggle.tsx'
import { SPINNER_ICON } from '@/components/ui/icons.tsx'
import { ToastProvider } from '@/components/ui/Toast.tsx'
import { TooltipProvider } from '@/components/ui/Tooltip.tsx'
import { useVault } from '@/vault/useVault.ts'
import { VaultProvider } from '@/vault/VaultContext.tsx'
import { HomeView } from '@/views/HomeView.tsx'
import { SetupView } from '@/views/SetupView.tsx'
import { UnlockView } from '@/views/UnlockView.tsx'

const Shell = (): JSX.Element => {
  const v = useVault()
  const [menuOpen, setMenuOpen] = useState(false)
  const showHeader = v.hasVault && !v.isLocked
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
      {showHeader ? (
        <Header onOpenMenu={() => setMenuOpen(true)} />
      ) : (
        <div className="flex justify-end pt-1 pb-3">
          <ThemeToggle />
        </div>
      )}
      {!v.hasVault && <SetupView />}
      {v.hasVault && v.isLocked && <UnlockView />}
      {v.hasVault && !v.isLocked && <HomeView />}
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
