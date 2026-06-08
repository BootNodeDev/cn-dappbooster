# Canton Barebones

Minimal local Canton barebones for wallet-first app experiments.

For the full dApp stack, follow the root runbook:

- [Quick Start](../README.md#quick-start)

## Start

Run only the local Canton participant, Postgres, and wallet-service:

```bash
cp .env.example .env
docker compose up -d
./scripts/health-check.sh
```

## Wallet service

`docker compose up -d` (via `npm run canton:up`) brings up `wallet-service` alongside postgres + canton. Verify with `npm run wallet-service:health`.

The wallet-service self-mints an HS256 JWT at boot from `CANTON_AUTH_AUDIENCE`, `CANTON_AUTH_SECRET`, and `CANTON_ADMIN_USER_ID`.

Set `WALLET_SERVICE_MOCK=1` in `.env` to short-circuit Canton calls; the service still starts but every `/rpc` method returns canned mock data.

Details:

- [wallet-service token](wallet-service/README.md#token)
- [wallet-service mock mode](wallet-service/README.md#mock-mode)

## Auth Config

The participant accepts local/dev HS256 JWTs configured by:

- `.env`: `CANTON_AUTH_AUDIENCE`, `CANTON_AUTH_SECRET`, `CANTON_ADMIN_USER_ID`
- [`config/canton/app.conf`](config/canton/app.conf): Canton ledger API auth service

## Ports

Refer to the [ports table in the root README](../README.md#ports) to see the
ports used by this stack.

## Deploy a DAR

Compile a Daml project outside this base, then upload the DAR. From the repo
root, build and deploy any project and DAR with the same two commands:

```bash
npm run build-dar -- <path/to/daml/project>
npm run deploy-dar -- <path/to/file.dar>
```

For the in-repo Tally package that means:

```bash
npm run build-dar -- dapp/daml
npm run deploy-dar -- dapp/daml/.daml/dist/quickstart-tally-0.0.1.dar
```

Or call the upload script directly:

```bash
./scripts/deploy-dar.sh /path/to/app.dar
```

`npm run canton:health` must return OK before deploying; otherwise the DAR
upload can fail.

This barebones intentionally does not include Keycloak, SV, PQS, frontend, or backend.
