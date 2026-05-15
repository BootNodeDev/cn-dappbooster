# Carpincho Wallet

Standalone browser wallet for the Canton base.

Carpincho is intentionally not the Counter backend and not a Canton participant. It is a wallet/provider UI with an encrypted local vault and WalletConnect support. A dApp pairs with Carpincho through WalletConnect; Carpincho answers wallet/provider requests and forwards Canton execution requests to the app's wallet-service JSON-RPC endpoint.

```text
dApp frontend -> WalletConnect -> carpincho-wallet -> wallet-service /rpc -> Canton participant
```

## Run

```bash
npm install
npm run dev
```

Dev server:

```text
http://localhost:3011
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
4. Select `carpincho-wallet-2/dist-extension`.
5. Open the Carpincho Wallet extension from the browser toolbar.

The extension uses its own `chrome-extension://` origin, so its encrypted vault
is separate from the development vault at `http://localhost:3011`.

## Runtime Config

The wallet has a `Connection settings` panel in the UI. The wallet-service JSON-RPC endpoint is stored in browser `localStorage` and starts with this scaffold default:

- Wallet-service JSON-RPC endpoint, for example `http://localhost:3010/rpc`.
- WalletConnect Canton network, for example `canton:local`.

WalletConnect still uses `.env.local`:

- `VITE_WC_PROJECT_ID` - required WalletConnect/Reown project id.

## API Boundary

WalletConnect is only the transport between the dApp and Carpincho. The provider method names follow the CIP-0103 shape:

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

## Current Scaffold State

- Local accounts are stored in the encrypted browser vault.
- `signMessage` is approved by the user in Carpincho and signed locally.
- `status` checks `wallet-service /rpc` and reports whether the Canton JSON API is reachable.
- `prepareExecute` and `prepareExecuteAndWait` show an approval screen, ask `wallet-service /rpc` to prepare the transaction, sign the prepared hash locally, then ask the service to execute it.
- `ledgerApi` is forwarded to `wallet-service /rpc` for participant reads.
- Account creation generates a local ed25519 keypair, asks `wallet-service /rpc` to create the Canton external party, signs the topology hash locally, and stores the returned party id in the encrypted vault.

## Attribution

Carpincho logo derived from the "Capybara" icon by Delapouite ([game-icons.net](https://game-icons.net/1x1/delapouite/capybara.html)), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Argentine flag colour sash and ring composited on top.
