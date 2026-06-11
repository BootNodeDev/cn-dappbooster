/// <reference types="vite/client" />

interface ImportMetaEnv {
  // CIP-0103 network id forwarded to ConnectKitProvider (e.g. 'canton:local').
  readonly VITE_CANTON_NETWORK?: string
  // WalletConnect Reown project id. Only needed for the WalletConnect fallback;
  // the Carpincho extension path works without it. When unset, the WalletConnect
  // CTA is hidden.
  readonly VITE_WC_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
