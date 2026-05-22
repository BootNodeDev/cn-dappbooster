# Canton Counter Scaffold

Minimal local stack:

```mermaid
flowchart TD
  fe["counter/frontend<br/>Counter dApp<br/>http://localhost:3012"]
  wallet["carpincho-wallet<br/>Vault + signer<br/>http://localhost:3011"]
  ws["counter/wallet-service<br/>Canton bridge<br/>http://localhost:3010"]
  cb["canton-base<br/>Participant JSON API http://localhost:3013<br/>Ledger/Admin gRPC localhost:3014 / 3015"]
  dar["counter/daml<br/>quickstart-counter DAR<br/>.daml/dist/*.dar"]

  fe <-->|"WalletConnect / CIP-0103"| wallet
  wallet -->|"JSON-RPC /rpc<br/>prepare, execute, read, onboard"| ws
  ws -->|"Canton JSON API<br/>Bearer CANTON_BACKEND_TOKEN"| cb
  dar -->|"deploy DAR package"| cb
```

The frontend knows the Counter DAML signature and talks to Carpincho through WalletConnect. Carpincho owns the local signing key and uses the wallet service to prepare, read, and execute against the Canton participant.

## Quick Start

Run the packages in this order for the local Counter flow.

## canton-base

Configure envs:

```bash
cp canton-base/.env.example canton-base/.env
```

Start Canton:

```bash
npm run canton:up
npm run canton:health
```

## deploy dars

Build:

```bash
npm run build-dar -- counter/daml
```

Make sure Canton is running:

```bash
npm run canton:health
```

Deploy DAR:

```bash
npm run deploy-dar -- counter/daml/.daml/dist/quickstart-counter-0.0.1.dar
```

Use the same format for any other DAML project and DAR:

```bash
npm run build-dar -- <path/to/daml/project>
npm run deploy-dar -- <path/to/file.dar>
```

`canton:health` must return OK before deploying; otherwise the DAR upload can fail.

## wallet service

Configure envs:

```bash
cp counter/wallet-service/.env.example counter/wallet-service/.env
npm run --silent canton:token
```

Copy the printed JWT into `counter/wallet-service/.env`:

```env
CANTON_BACKEND_TOKEN=<printed JWT>
```

Run the service:

```bash
npm --prefix counter/wallet-service install
npm run wallet-service:dev
```

## wallet

### Install the extension from the Chrome Web Store

WIP. The extension is not deployed there yet.

### Use the extension from source

Build the extension:

```bash
npm --prefix carpincho-wallet install
npm run carpincho:build:extension
```

The build output is:

```text
carpincho-wallet/dist-extension
```

Then load it in Chrome with the shared steps below.

### Use the extension from GitHub release source

WIP. Release artifacts are not available yet.

After downloading and unpacking a release artifact, load it in Chrome with the shared steps below.

### Load an unpacked extension in Chrome

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the unpacked extension folder (`carpincho-wallet/dist-extension` for a source build).

## dapp

Install the local connect kit first so Vite can resolve its peer/dev dependencies.

```bash
npm --prefix canton-connect-kit install
npm --prefix counter/frontend install
npm run app:dev
```

Open:

```text
http://localhost:3012
```

In the frontend:

1. Keep `canton:local` in settings.
2. Click `Connect with Carpincho`.
3. Approve the request in Carpincho.

## Ports

Local ports are intentionally assigned in the `3010+` range:

| Component                   | URL / Port              |
| --------------------------- | ----------------------- |
| Counter wallet service      | `http://localhost:3010` |
| Carpincho wallet            | `http://localhost:3011` |
| Counter frontend            | `http://localhost:3012` |
| Canton JSON API             | `http://localhost:3013` |
| Canton Ledger API           | `grpc://localhost:3014` |
| Canton Admin API            | `grpc://localhost:3015` |
| Canton health               | `http://localhost:3016` |
| Canton sequencer public API | `localhost:3017`        |
| Canton Postgres             | `localhost:3018`        |
