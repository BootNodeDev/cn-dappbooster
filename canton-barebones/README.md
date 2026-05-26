# Canton Barebones

Minimal local Canton barebones for wallet-first app experiments.

## Start

```bash
cp .env.example .env
docker compose up -d
./scripts/health-check.sh
```

## Wallet service

`docker compose up -d` (via `npm run canton:up`) brings up `wallet-service` alongside postgres + canton. Verify with `npm run wallet-service:health`.

The wallet-service self-mints an HS256 JWT at boot from `CANTON_AUTH_AUDIENCE`, `CANTON_AUTH_SECRET`, and `CANTON_BACKEND_USER_ID`. Set `CANTON_BACKEND_TOKEN` explicitly in the compose env override (or this `.env`) to bypass the self-mint.

Set `WALLET_SERVICE_MOCK=1` in `.env` to short-circuit Canton calls; the service still starts but every `/rpc` method returns canned mock data.

## Backend Token (ad-hoc)

The participant accepts HS256 JWTs configured by `.env`:

- `CANTON_AUTH_AUDIENCE`
- `CANTON_AUTH_SECRET`
- `CANTON_BACKEND_USER_ID`

Generate a token from this package (useful for paste-into-curl debugging):

```bash
npm run --silent token
```

Or from the repository root:

```bash
npm run --silent canton:token
```

The token script does not mint assets or funds. It only creates a local development auth token. Regenerate it when `CANTON_AUTH_AUDIENCE`, `CANTON_AUTH_SECRET`, or the wallet-service user id changes.

`scripts/mint-token.mjs` is the Node.js implementation. `scripts/mint-token.sh` is kept as a compatibility wrapper for older commands.

## URLs

- JSON Ledger API: `http://localhost:3013`
- Ledger API: `grpc://localhost:3014`
- Admin API: `grpc://localhost:3015`
- Health: `http://localhost:3016`
- Sequencer public API: `localhost:3017`
- Postgres: `localhost:3018`

## Deploy a DAR

Compile a Daml project outside this base, then upload the DAR:

```bash
./scripts/deploy-dar.sh /path/to/app.dar
```

This barebones intentionally does not include Keycloak, SV, PQS, frontend, backend, or wallet service.
