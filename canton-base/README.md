# Canton Base

Minimal local Canton base for wallet-first app experiments.

## Start

```bash
cp .env.example .env
./scripts/mint-token.sh wallet-service
docker compose up -d
./scripts/health-check.sh
```

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
