// canton-connect-kit — wagmi-style React hooks for connecting Canton dApps
// to CIP-0103 wallets. See README.md for the design rationale.

export type {
  ConnectKitContextValue,
  ConnectKitProviderProps,
  TxStatusSnapshot,
} from './ConnectKitProvider.tsx'
export { ConnectKitProvider, useConnectKitContext } from './ConnectKitProvider.tsx'
export type { CreateExtensionConnectorOptions } from './connectors/extension.ts'
export { createExtensionConnector, DEFAULT_EXTENSION_TARGET } from './connectors/extension.ts'
export { createWalletConnectConnector } from './connectors/walletconnect.ts'
export type { UseConnectResult } from './hooks/useConnect.ts'
export { useConnect } from './hooks/useConnect.ts'
export type { ExecuteParams, UseExecuteResult } from './hooks/useExecute.ts'
export { useExecute } from './hooks/useExecute.ts'
export type { LedgerApiParams, UseLedgerResult } from './hooks/useLedger.ts'
export { useLedger } from './hooks/useLedger.ts'
export type { UsePartyResult } from './hooks/useParty.ts'
export { useParty } from './hooks/useParty.ts'
export type { UseSignMessageResult } from './hooks/useSignMessage.ts'
export { useSignMessage } from './hooks/useSignMessage.ts'
export type { UseWalletStatusResult } from './hooks/useWalletStatus.ts'
export { useWalletStatus } from './hooks/useWalletStatus.ts'
export type { RawWalletAccount } from './lib/walletAccount.ts'
export { selectPrimaryAccount, toParty } from './lib/walletAccount.ts'

export type {
  ConnectionStatus,
  ConnectKitConfig,
  ConnectMode,
  Connector,
  ConnectorProvider,
  ExtensionConnector,
  Party,
  WalletConnectConnector,
  WalletConnectConnectorOptions,
} from './types.ts'
