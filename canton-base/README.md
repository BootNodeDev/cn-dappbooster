# Canton Base

Minimal local Canton base for wallet-first app experiments.

## Start

```bash
cp .env.example .env
docker compose up -d
./scripts/health-check.sh
```

## Backend Token

The local Canton participant accepts HS256 JWTs configured by `.env`:

- `CANTON_AUTH_AUDIENCE`
- `CANTON_AUTH_SECRET`
- `CANTON_ADMIN_USER_ID`

Generate a token for the wallet-service user from this package:

```bash
npm run --silent token
```

Or from the repository root:

```bash
npm run --silent canton:token
```

Put the printed JWT in `counter/wallet-service/.env` as
`CANTON_BACKEND_TOKEN`. The wallet-service uses that token to authenticate its
Canton JSON API calls for external party onboarding, active-contract reads,
transaction preparation, and prepared transaction execution.

The token script does not mint assets or funds. It only creates a local
development auth token. Regenerate it when `CANTON_AUTH_AUDIENCE`,
`CANTON_AUTH_SECRET`, or the wallet-service user id changes.

`scripts/mint-token.mjs` is the Node.js implementation. `scripts/mint-token.sh`
is kept as a compatibility wrapper for older commands.

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

This base intentionally does not include Keycloak, SV, PQS, frontend, backend, or wallet service.
