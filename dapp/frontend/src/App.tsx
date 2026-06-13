import { createRouter, RouterProvider } from '@tanstack/react-router'
import { ConnectKitProvider } from 'canton-connect-kit'
import { useState } from 'react'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { DarkPoolProvider } from '@/darkpool/DarkPoolProvider'
import { ConnectionBar } from './ConnectionBar'
import { routeTree } from './routeTree.gen'
import { loadRuntimeConfig } from './runtimeConfig'

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

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
            <DarkPoolProvider>
              <RouterProvider router={router} />
            </DarkPoolProvider>
          </ConnectionBar>
        </ConnectKitProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
