import { ConnectKitProvider } from 'canton-connect-kit'
import { useState } from 'react'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ConnectionBar } from './ConnectionBar'
import { LoyaltyCard } from './features/loyalty/index'
import { SignMessageDemo } from './features/sign-message/index'
import { loadRuntimeConfig } from './runtimeConfig'

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

// dApp starter shell. Everything under src/features/<name>/ is a removable demo:
// to drop one, delete its folder + its import and <…/> line below, plus
// ../e2e/tests/features/<name>/. See README "Removing a feature".
export const App = (): JSX.Element => {
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  return (
    <TooltipProvider>
      <ToastProvider>
        <ConnectKitProvider
          config={{
            appName: 'Canton dApp Starter',
            appDescription: 'Starter dApp on the Canton barebones stack',
            network: runtimeConfig.cantonNetwork,
            walletConnectProjectId: envString('VITE_WC_PROJECT_ID'),
          }}
        >
          <ConnectionBar>
            <LoyaltyCard />
            <SignMessageDemo />
          </ConnectionBar>
        </ConnectKitProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
