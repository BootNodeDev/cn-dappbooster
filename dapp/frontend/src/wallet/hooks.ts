// Hook surface for the dApp. Wallet-lifecycle hooks (useConnect, useParty,
// useWalletStatus) come straight from canton-connect-kit; useBackend hands the
// store the AmuletBackend wired to the connected wallet. Components import from
// here so the wallet layer stays a single swap point.

import type { VestingBackend } from '@/backend/VestingBackend'
import { useVestingData } from './VestingDataProvider'

export type {
  UseConnectResult,
  UsePartyResult,
  UseWalletStatusResult,
} from 'canton-connect-kit'
export { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'

export const useBackend = (): VestingBackend => useVestingData().backend

export const useBackendAvailable = (): boolean => useVestingData().backendAvailable
