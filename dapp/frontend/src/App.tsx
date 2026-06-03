import { ConnectKitProvider } from 'canton-connect-kit'
import { useState } from 'react'
import { ConnectionBar } from './ConnectionBar.js'
import { Counter } from './features/counter/index.js'
import { SignMessageDemo } from './features/sign-message/index.js'
import { loadRuntimeConfig } from './runtimeConfig.js'

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

// dApp starter shell. Everything under src/features/<name>/ is a removable demo:
// to drop one, delete its folder + its import and <…/> line below, plus
// ../e2e/tests/features/<name>/. See README "Removing a feature".
export const App = (): JSX.Element => {
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  return (
    <ConnectKitProvider
      config={{
        appName: 'Canton dApp Starter',
        appDescription: 'Starter dApp on the Canton barebones stack',
        network: runtimeConfig.cantonNetwork,
        walletConnectProjectId: envString('VITE_WC_PROJECT_ID'),
      }}
    >
      <ConnectionBar>
        <Counter />
        <SignMessageDemo />
      </ConnectionBar>
    </ConnectKitProvider>
  )
}
