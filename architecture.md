# Architecture Overview — Canton dApp Booster

<!-- Monorepo-level architecture. Captures the shape of the whole stack:
     subprojects, ports, data flow between components, environment variables.
     For wallet-internal architecture (vault, CIP-0103 provider, extension
     scripts), see carpincho-wallet/architecture.md. -->

## Tech Stack (per subproject)

| Subproject | Stack | Purpose |
|------------|-------|---------|
| `canton-barebones/` | Docker Compose + Bash + Node scripts | Local Canton participant node, Postgres, mint-token helper, DAR deploy script, health-check |
| `dapp/daml/vesting-lite/` | DAML (`dpm` build) | `vesting-lite` model — DAR consumed by Canton |
| `canton-barebones/wallet-service/` | Node 24 + Express 5 + TypeScript + `@canton-network/wallet-sdk` | JSON-RPC bridge between the wallet and the Canton participant JSON API. Started by `npm run canton:up` as a docker-compose service. Self-mints its Canton JWT at boot from `CANTON_AUTH_AUDIENCE` / `CANTON_AUTH_SECRET`. `WALLET_SERVICE_MOCK=1` (`src/mock.ts`) short-circuits the dispatcher with canned responses. |
| `carpincho-wallet/` | Vite 6 + React 18 + Tailwind v4 + Radix UI + Biome + WalletConnect Sign Client 2.x + `@noble/ed25519` | CIP-0103 wallet (web + Chrome extension), encrypted local vault, signing, injected provider, optional WalletConnect |
| `dapp/frontend/` | Vite 6 + React 19 + Tailwind v4 + zustand + react-router-dom + Vitest + Biome | Direct-access dApp UI — talks to the wallet-service over JSON-RPC (no CIP-0103 injected provider, no Radix UI, no dapp-sdk) |
| `dapp/e2e/` | Playwright + TypeScript | Black-box integration tests for the dApp, Carpincho, wallet-service, and Canton stack |

## Project Structure

```
.
├── .claude/
│   ├── settings.local.json        (gitignored)
│   └── skills/{create-pr,issue}   Agent helper skills
├── .github/
│   ├── ISSUE_TEMPLATE/            bug / feature / epic / spike templates
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/                        commit-msg, pre-commit, pre-push hooks
├── canton-barebones/              Local Canton participant + Postgres + wallet-service
├── canton-connect-kit/            React hooks for CIP-0103 wallet connections
├── carpincho-wallet/              CIP-0103 wallet (web + Chrome extension)
├── dapp/
│   ├── daml/vesting-lite/         vesting-lite DAML model
│   ├── frontend/                  dApp UI
│   └── e2e/                       Black-box integration tests
├── AGENTS.md                      Agent rules — monorepo-wide
├── CLAUDE.md                      Compatibility shim pointing to AGENTS.md
├── architecture.md                THIS FILE
├── README.md                      Bring-up runbook for the local stack
├── commitlint.config.js           Conventional Commit enforcement
├── .lintstagedrc.mjs              Per-subproject lint dispatch
├── .nvmrc                         Node 24
└── package.json                   npm workspaces root + orchestration scripts (npm --prefix <dir>)
```

## Data Flow

The whole local stack is one signing loop. The dApp frontend discovers Carpincho through the injected CIP-0103 browser provider; Carpincho signs locally and routes the signed transaction through the wallet-service JSON-RPC bridge, which calls the Canton participant's JSON API; the participant materialises the change against the deployed `vesting-lite` DAR. WalletConnect remains available as an opt-in fallback path.

```mermaid
flowchart TD
  fe["dapp/frontend<br/>dApp frontend<br/>http://localhost:3012"]
  wallet["carpincho-wallet<br/>Vault + signer<br/>http://localhost:3011"]
  ws["canton-barebones/wallet-service<br/>Canton bridge<br/>http://localhost:3010"]
  cb["canton-barebones<br/>Participant JSON API http://localhost:3013<br/>Ledger/Admin gRPC localhost:3014 / 3015"]
  dar["dapp/daml/vesting-lite<br/>vesting-lite DAR<br/>.daml/dist/*.dar"]

  fe <-->|"Injected CIP-0103 provider<br/>optional WalletConnect"| wallet
  wallet -->|"JSON-RPC /rpc<br/>prepare, execute, read, onboard"| ws
  ws -->|"Canton JSON API<br/>Bearer CANTON_BACKEND_TOKEN"| cb
  dar -->|"deploy DAR package"| cb
```

State boundaries:

- `dapp/frontend` never touches the participant directly. It only knows about Carpincho through the injected CIP-0103 provider (or optional WalletConnect fallback) and the dApp's DAML signature.
- `carpincho-wallet` holds all signing keys (PBKDF2 + AES-GCM vault, Ed25519). It never talks to Canton directly; it goes through `canton-barebones/wallet-service`.
- `canton-barebones/wallet-service` is the only component holding the Canton bearer token. It self-mints the token at boot, then validates and forwards JSON-RPC calls onto the participant's JSON API.
- `canton-barebones` is the participant. Its bearer-token validation pins the trust boundary.

## Service Ports

Local ports are intentionally assigned in the `3010+` range so they collide with nothing else on a dev machine.

| Component | URL / Port |
|-----------|------------|
| Wallet service | `http://localhost:3010` |
| Carpincho wallet | `http://localhost:3011` |
| dApp frontend | `http://localhost:3012` |
| Canton JSON API | `http://localhost:3013` |
| Canton Ledger API | `grpc://localhost:3014` |
| Canton Admin API | `grpc://localhost:3015` |
| Canton health | `http://localhost:3016` |
| Canton sequencer public API | `localhost:3017` |
| Canton Postgres | `localhost:3018` |

## Environment Variables

| Variable | Owner | Purpose |
|----------|-------|---------|
| `VITE_WC_PROJECT_ID` | `carpincho-wallet/.env.local`, `dapp/frontend/.env.local` | Optional WalletConnect / Reown project ID. Same value in both subprojects when using the WalletConnect fallback; not required for the injected extension provider path. |
| `CANTON_BACKEND_TOKEN` | `canton-barebones/wallet-service` runtime env (compose) | Self-minted at boot from `CANTON_AUTH_AUDIENCE` / `CANTON_AUTH_SECRET` / `CANTON_ADMIN_USER_ID`. Set explicitly (e.g. via the compose env override) to bypass self-mint. Mint ad-hoc with `npm run canton:token`. |

Runtime-only configuration that varies between sessions (RPC URL, Canton network name, Carpincho URL) is stored in `localStorage` inside the wallet and the frontend, configured from each UI — not from env files.

## Orchestration Scripts

Driven from root `package.json`:

| Command | What it does |
|---------|--------------|
| `npm run canton:up` / `canton:down` | docker compose up/down inside `canton-barebones/` |
| `npm run canton:health` | Hit the participant health endpoint at `:3016` |
| `npm run canton:token` | Mint a dev JWT for the wallet-service user |
| `npm run build-dar -- <daml-project>` | DAML build via `dpm` inside the provided DAML project directory |
| `npm run deploy-dar -- <dar>` | Deploy the provided DAR to the local participant |
| `npm --prefix canton-barebones/wallet-service run dev` | Host-side dev mode for the wallet-service on `:3010` (tsx watch). The container-side service is started by `canton:up`. |
| `npm run wallet-service:health` | Hit the wallet-service health endpoint at `:3010` |
| `npm --prefix canton-barebones run wallet-service:logs` | Tail the wallet-service container's logs |
| `npm run carpincho:build:extension` | Build the Chrome extension into `carpincho-wallet/dist-extension` |
| `npm run app:dev` | Start the dApp frontend on `:3012` (Vite, strict port) |

For the full bring-up sequence, follow [`README.md`](README.md).

## Further Reading

- [`carpincho-wallet/architecture.md`](carpincho-wallet/architecture.md) — wallet-internal architecture: Vault crypto, CIP-0103 dispatcher, WalletConnect integration, Chrome extension bridge, theming, auth/session
- [`canton-connect-kit/architecture.md`](canton-connect-kit/architecture.md) — connect-kit internals: provider context, connectors, hooks, event bridge
- [`canton-barebones/README.md`](canton-barebones/README.md) — local participant setup
- [`dapp/daml/vesting-lite/README.md`](dapp/daml/vesting-lite/README.md) — DAML model
- [`canton-barebones/wallet-service/README.md`](canton-barebones/wallet-service/README.md) — JSON-RPC bridge
- [`dapp/frontend/README.md`](dapp/frontend/README.md) — dApp UI
- [`dapp/e2e/README.md`](dapp/e2e/README.md) — black-box integration tests
