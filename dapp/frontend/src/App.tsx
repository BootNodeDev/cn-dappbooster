import { ConnectKitProvider } from 'canton-connect-kit'
import { useState } from 'react'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ConnectionBar } from './ConnectionBar'
import { loadRuntimeConfig } from './runtimeConfig'

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

export const App = (): JSX.Element => {
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  return (
    <TooltipProvider>
      <ToastProvider>
        <ConnectKitProvider
          config={{
            appName: 'cn-darkpools',
            appDescription: 'Private dark-pool trading on Canton Network',
            network: runtimeConfig.cantonNetwork,
            walletConnectProjectId: envString('VITE_WC_PROJECT_ID'),
          }}
        >
          <ConnectionBar>
            <div className="p-8 text-center text-muted-foreground">cn-darkpools — scaffolding</div>
          </ConnectionBar>
        </ConnectKitProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
