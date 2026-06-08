# Carpincho Wallet

Standalone browser wallet for the Canton barebones.

Carpincho is a wallet/provider UI with an encrypted local vault, an injected CIP-0103 browser provider, and optional WalletConnect support. A dApp connects to Carpincho through the injected provider by default; Carpincho answers wallet/provider requests and forwards Canton execution requests to the app's wallet-service JSON-RPC endpoint.

```text
dApp frontend -> injected CIP-0103 provider -> carpincho-wallet -> wallet-service /rpc -> Canton participant
```

## Run

For the full local stack, follow the root [quick start](../README.md#quick-start).

This package can also run on its own as a web app:

```bash
npm run dev
# http://localhost:3011
```

## Browser extension

The extension uses its own `chrome-extension://` origin, so its encrypted vault
is separate from the web dev vault at `http://localhost:3011`.

### From the Chrome Web Store

Not yet published.

### From source

```bash
npm run carpincho:build:extension   # from the repo root
```

The build output is `carpincho-wallet/dist-extension`. Load it with the steps
below.

### From a GitHub release

Publishing a GitHub Release builds the extension and attaches a
`carpincho-wallet-<version>.zip` asset. Download, unpack, and load it with the
steps below.

### Load an unpacked extension in Chrome

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the unpacked extension folder (`carpincho-wallet/dist-extension` for a
   source build).

## Runtime Config

The wallet has a `Connection settings` panel in the UI. The wallet-service JSON-RPC endpoint is stored in browser `localStorage` and starts with this scaffold default:

- Wallet-service JSON-RPC endpoint, for example `http://localhost:3010/rpc`.
- Canton network, for example `canton:local`.

WalletConnect fallback still uses `.env.local`:

- `VITE_WC_PROJECT_ID` - optional WalletConnect/Reown project id.

For the full WalletConnect setup, see the dApp frontend
[WalletConnect fallback](../dapp/frontend/README.md#walletconnect-fallback).

## API Boundary

The injected extension provider is the primary transport between the dApp and
Carpincho. WalletConnect is an optional fallback transport. Provider method
names and payloads follow CIP-0103:

- [CIP-0103 Provider API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#provider-api)
- [CIP-0103 Synchronous dApp API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#synchronous-dapp-api)
- [wallet-service API boundary](../canton-barebones/wallet-service/README.md#api-boundary)

For compatibility with the old quickstart wallet, Carpincho also accepts legacy `canton_*` aliases and normalizes them internally.

### Event broadcasts

The dapp-api defines event methods (`accountsChanged`, `txChanged`, `connected`,
`statusChanged`) but the canonical extension transport
(`@canton-network/core-rpc-transport`'s `WindowTransport`) carries
request/response only. Carpincho adds a `SPLICE_WALLET_EVENT` postMessage type
that delivers wallet→page broadcasts through the same content-script channel.
Broadcast path:

| Step | Sender         | Transport                    | Message                     | Receiver       |
| ---- | -------------- | ---------------------------- | --------------------------- | -------------- |
| 1    | popup          | `chrome.runtime.sendMessage` | `CARPINCHO_BROADCAST_EVENT` | background     |
| 2    | background     | `chrome.tabs.sendMessage`    | `CARPINCHO_EVENT_RELAY`     | content script |
| 3    | content script | `window.postMessage`         | `SPLICE_WALLET_EVENT`       | dApp page      |
| 4    | provider       | internal emit                | `eventName`, `payload`      | dApp handler   |

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
