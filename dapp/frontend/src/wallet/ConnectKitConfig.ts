// ConnectKitProvider configuration for the vesting dApp. Kept in one place so
// App.tsx stays thin and the landing can read the same WalletConnect flag.

import type { ConnectKitConfig } from 'canton-connect-kit'

const envString = (value: string | undefined): string => (value ?? '').trim()

const walletConnectProjectId = envString(import.meta.env.VITE_WC_PROJECT_ID)

// The WalletConnect connector throws without a project id, so the landing only
// offers that path when one is configured. The Carpincho extension always works.
export const walletConnectEnabled = walletConnectProjectId !== ''

export const connectKitConfig: ConnectKitConfig = {
  appName: 'Canton Vesting',
  appDescription: 'On-ledger Canton Coin vesting — escrow, claim, and create grants',
  network: envString(import.meta.env.VITE_CANTON_NETWORK) || 'canton:local',
  ...(walletConnectEnabled ? { walletConnectProjectId } : {}),
}
