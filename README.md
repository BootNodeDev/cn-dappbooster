# Canton Counter Scaffold

Minimal local stack:

```text
canton-base -> counter/wallet-service -> carpincho-wallet -> counter/frontend
```

The frontend knows the Counter DAML signature and talks to Carpincho through WalletConnect. Carpincho owns the local signing key and uses the wallet service to prepare, read, and execute against the Canton participant.

## 0. One-Time Config

WalletConnect needs a Reown project id in both browser apps:

```bash
cd carpincho-wallet
cp .env.local.example .env.local
# edit .env.local: VITE_WC_PROJECT_ID=...

cd ../counter/frontend
cp .env.local.example .env.local
# edit .env.local with the same VITE_WC_PROJECT_ID
```

The Canton network, Carpincho URL, and wallet-service URL are configured from the app UIs, not from env files. The defaults are:

- Canton network: `canton:local`
- Wallet-service RPC URL in Carpincho: `http://localhost:3010/rpc`
- Carpincho URL in frontend: `http://localhost:3011`

Local ports are intentionally assigned in the `3010+` range:

| Component | URL / Port |
| --- | --- |
| Counter wallet service | `http://localhost:3010` |
| Carpincho wallet | `http://localhost:3011` |
| Counter frontend | `http://localhost:3012` |
| Canton JSON API | `http://localhost:3013` |
| Canton Ledger API | `grpc://localhost:3014` |
| Canton Admin API | `grpc://localhost:3015` |
| Canton health | `http://localhost:3016` |
| Canton sequencer public API | `localhost:3017` |
| Canton Postgres | `localhost:3018` |

## 1. Start Canton

```bash
npm run canton:up
npm run canton:health
```

Useful endpoints:

- JSON API: `http://localhost:3013`
- Ledger API: `grpc://localhost:3014`
- Admin API: `grpc://localhost:3015`
- Health: `http://localhost:3016`

## 2. Compile Counter

```bash
npm run counter:build-dar
```

Expected DAR:

```text
.daml/dist/quickstart-counter-0.0.1.dar
```

## 3. Deploy the DAR

```bash
npm run counter:deploy-dar
```

## 4. Start Counter Wallet Service

```bash
npm --prefix counter/wallet-service install
npm run wallet-service:dev
```

Checks:

```bash
curl http://localhost:3010/health
curl http://localhost:3010/
curl -s http://localhost:3010/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"status"}'
```

## 5. Start Carpincho Wallet

```bash
npm --prefix carpincho-wallet install
npm run wallet:dev
```

Open:

```text
http://localhost:3011
```

In Carpincho:

1. Create/unlock the vault.
2. In `Connection settings`, keep `http://localhost:3010/rpc` and `canton:local`.
3. Add an account. Carpincho generates an ed25519 keypair and asks the wallet-service to create the Canton external party.

## 6. Start the Counter App

```bash
npm --prefix counter/frontend install
npm run app:dev
```

Open:

```text
http://localhost:3012
```

In the frontend:

1. Keep `canton:local` and `http://localhost:3011` in settings.
2. Click `Connect Carpincho`.
3. Open/approve the WalletConnect request in Carpincho.
4. Create a counter or refresh visible counters.

## Normal Flow

```text
frontend
  -> WalletConnect
  -> carpincho-wallet
  -> counter/wallet-service
  -> canton-base participant
```
