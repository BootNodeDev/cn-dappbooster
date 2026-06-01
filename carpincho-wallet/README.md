# Carpincho Wallet

Standalone browser wallet for the Canton barebones.

Carpincho is intentionally not the Counter backend and not a Canton participant. It is a wallet/provider UI with an encrypted local vault, an injected CIP-0103 browser provider, and optional WalletConnect support. A dApp connects to Carpincho through the injected provider by default; Carpincho answers wallet/provider requests and forwards Canton execution requests to the app's wallet-service JSON-RPC endpoint.

```text
dApp frontend -> injected CIP-0103 provider -> carpincho-wallet -> wallet-service /rpc -> Canton participant
```

## Run

Build the Chrome extension from the repository root:

```bash
npm --prefix .. run carpincho:build:extension
```

Build the Chrome extension from this package:

```bash
npm install
npm run build:extension
```

Load the extension in Chrome from:

```text
dist-extension/
```

For the full local flow, follow the root [`README.md`](../README.md).

Optional dev server:

```bash
npm run dev
# serves on http://localhost:3011
```

## Local Browser Extension

Build the unpacked Chromium extension:

```bash
npm run build:extension
```

Then install it locally:

1. Open `chrome://extensions` or the equivalent Chromium extensions page.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `dist-extension`.
5. Open the Carpincho Wallet extension from the browser toolbar.

The extension uses its own `chrome-extension://` origin, so its encrypted vault
is separate from the development vault at `http://localhost:3011`.

## Runtime Config

The wallet has a `Connection settings` panel in the UI. The wallet-service JSON-RPC endpoint is stored in browser `localStorage` and starts with this scaffold default:

- Wallet-service JSON-RPC endpoint, for example `http://localhost:3010/rpc`.
- Canton network, for example `canton:local`.

WalletConnect fallback still uses `.env.local`:

- `VITE_WC_PROJECT_ID` - optional WalletConnect/Reown project id.

## API Boundary

The injected extension provider is the primary transport between the dApp and Carpincho. WalletConnect is an optional fallback transport. The provider method names follow the CIP-0103 shape:

- `connect`
- `disconnect`
- `isConnected`
- `status`
- `getActiveNetwork`
- `listAccounts`
- `getPrimaryAccount`
- `signMessage`
- `prepareExecute`
- `prepareExecuteAndWait`
- `ledgerApi`

For compatibility with the old quickstart wallet, Carpincho also accepts legacy `canton_*` aliases and normalizes them internally.

### Event broadcasts

The dapp-api defines event methods (`accountsChanged`, `txChanged`, `connected`,
`statusChanged`) but the canonical extension transport
(`@canton-network/core-rpc-transport`'s `WindowTransport`) carries
request/response only. Carpincho adds a `SPLICE_WALLET_EVENT` postMessage type
that delivers wallet→page broadcasts through the same content-script channel.
The wire:

```text
popup (vault mutation)
  -> chrome.runtime.sendMessage     CARPINCHO_BROADCAST_EVENT
background.ts
  -> chrome.tabs.sendMessage         CARPINCHO_EVENT_RELAY
contentScript.ts
  -> window.postMessage              SPLICE_WALLET_EVENT
dApp page
  -> provider.emit(eventName, payload)
```

The canonical `@canton-network/dapp-sdk`'s `client.onAccountsChanged(handler)` /
`client.onTxChanged(handler)` / `client.onConnected(handler)` /
`client.onStatusChanged(handler)` APIs fire on top of this. See
[`src/extension/eventBroadcast.ts`](src/extension/eventBroadcast.ts) and
[`src/extension/messages.ts`](src/extension/messages.ts) for the wire shapes.

## Current Scaffold State

- Local accounts are stored in the encrypted browser vault (PBKDF2 600k iterations + AES-256-GCM via SubtleCrypto).
- `signMessage` is approved by the user in Carpincho and signed locally with Ed25519. Returns `{signature: base64}` per spec.
- `status` checks `wallet-service /rpc` and reports whether the Canton JSON API is reachable.
- `prepareExecute` and `prepareExecuteAndWait` show an approval screen, ask `wallet-service /rpc` to prepare the transaction, sign the prepared hash locally, then ask the service to execute it. Emits `txChanged` events at each transition: `pending → signed → executed` (or `failed`).
- `ledgerApi` is forwarded to `wallet-service /rpc` for participant reads. The body is passed through opaquely; the dApp sends participant-native shapes.
- Account creation generates a local Ed25519 keypair, calls `wallet-service /admin/party/prepare` to build the topology transaction, signs the topology hash locally, calls `wallet-service /admin/party/complete` to submit, and stores the returned party id in the encrypted vault. Emits `accountsChanged` when the active set changes (add / remove / setPrimary).
- Vault lifecycle (setup, unlock, lock, destroy) emits `connected` (on transition into the unlocked state) and `statusChanged` (on every transition) so dApps can react to user-driven lock/unlock without polling.
- Auto-lock with idle timeout, session-password caching in `chrome.storage.session` (extension) or `sessionStorage` (web).
