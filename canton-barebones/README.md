# Canton Barebones

Local Splice LocalNet wrapper for Canton dApp Booster.

This package starts the official Splice LocalNet bundle with:

```text
sv
app-user
wallet-gateway or wallet-gateway-devkit
```

It does not start:

```text
Keycloak/OIDC
```

It also does not start the app-provider UI containers. A local compose override
disables app-provider Nginx routes. The official shared Canton/Splice
containers still expose app-provider backend ports because the bundle bakes
that config in.

Splice, wallet-gateway, and wallet-gateway-devkit share the
`canton-barebones` Docker Compose project, so Docker groups the selected local
stack together.

`app-user` is Splice's primary local validator name. It is not the Carpincho
user and not a product user.

## Start

```bash
npm run up
```

From the repo root, use:

```bash
npm run canton:up
```

`npm run up` and `npm run canton:up` use devkit mode by default.
`npm run canton:up -- --help` prints the root command flags.

## Gateway Modes

Use one gateway mode per local stack:

```bash
npm run up -- wallet-gateway          # Splice + official wallet-gateway
npm run up -- wallet-gateway-devkit   # Splice + wallet-gateway + devkit facade
```

From the repo root:

```bash
npm run canton:up -- wallet-gateway
npm run canton:up -- wallet-gateway-devkit
```

The official wallet-gateway is always public on `http://localhost:3010`.
In devkit mode, wallet-gateway-devkit is also public on `http://localhost:3011`.
Carpincho points at `http://localhost:3011/rpc` when it needs devkit helper
RPCs. Canton, Scan, validator, and registry URLs stay in
`env/.env.wallet-gateway-devkit`.

## Environment Config

Runtime config is split by service:

| File | Purpose |
| --- | --- |
| `env/.env.splice` | Splice bundle tag, cache path, compose project, and profiles |
| `env/.env.wallet-gateway` | official wallet-gateway public port |
| `env/.env.wallet-gateway-devkit` | devkit public port, Canton/Scan URLs, provider metadata, auth, upstream wallet-gateway URL |
| `config/wallet-gateway/config.json` | JSON config consumed by the official wallet-gateway package |

The real service env files are ignored because they can contain secrets. Start
from the service examples:

```bash
cp env/examples/.env.splice.example env/.env.splice
cp env/examples/.env.wallet-gateway.example env/.env.wallet-gateway
cp env/examples/.env.wallet-gateway-devkit.example env/.env.wallet-gateway-devkit
```

`docker-compose.yaml` fixes `WALLET_GATEWAY_CONFIG` to
`./config/wallet-gateway/config.json` by default. Override it from the shell
only if you need a different official wallet-gateway JSON:

```bash
WALLET_GATEWAY_CONFIG=./path/to/wallet-gateway-config.json npm run up -- wallet-gateway
```

Use the service env files directly when pointing devkit at external endpoints.

## Auth

wallet-gateway-devkit supports three auth modes through
`env/.env.wallet-gateway-devkit`:

| Mode | Required values |
| --- | --- |
| `self-signed` | `AUTH_SECRET`, optional `AUTH_AUDIENCE`, `AUTH_SUBJECT` |
| `oauth-client-credentials` | `AUTH_TOKEN_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, optional `AUTH_SCOPE` |
| `static-token` | `AUTH_TOKEN` |

`static-token` mode expects an already-issued bearer token in `AUTH_TOKEN`.

Do not put `AUTH_SECRET`, OAuth client secrets, or bearer tokens in Carpincho.
Carpincho points at one gateway URL.

## Wallet Gateway Devkit

`npm run up` starts wallet-gateway-devkit after app-user is ready.

wallet-gateway-devkit points to app-user through
`env/.env.wallet-gateway-devkit`:

```text
JSON API   http://host.docker.internal:2975
Ledger API grpc://host.docker.internal:2901
Admin API  grpc://host.docker.internal:2902
```

To use an external Splice stack, edit `env/.env.wallet-gateway-devkit` and skip
LocalNet startup:

```bash
npm run up -- --no-splice wallet-gateway-devkit
```

## Services And Ports

| Service | What It Is | URL / Port |
| --- | --- | --- |
| wallet-gateway | official wallet-gateway | `http://localhost:3010` |
| wallet-gateway-devkit | public facade plus dev helpers | `http://localhost:3011` |
| app-user Wallet UI | official Splice wallet UI | `http://wallet.localhost:2000` |
| app-user Ledger API | gRPC Ledger API | `grpc://localhost:2901` |
| app-user Admin API | gRPC Admin API | `grpc://localhost:2902` |
| app-user Validator API | Splice validator API | `http://localhost:2903` |
| app-user JSON API | JSON Ledger API | `http://localhost:2975` |
| app-user Validator proxy | wallet-sdk validator route | `http://localhost:2000/api/validator` |
| app-provider backend APIs | official bundle backend wiring, unused here | `grpc://localhost:3901`, `grpc://localhost:3902`, `http://localhost:3903`, `http://localhost:3975` |
| app-provider UI port | Nginx port exposed by the bundle; routes disabled here | `http://localhost:3000` |
| Scan UI | Splice explorer/read model | `http://scan.localhost:4000` |
| Scan API | indexed Splice API | `http://scan.localhost:4000/api/scan` |
| Amulet Registry | token metadata via scan proxy | `http://localhost:2000/api/validator/v0/scan-proxy` |
| SV UI | Super Validator operations UI | `http://sv.localhost:4000` |
| sv Ledger/Admin/JSON APIs | official SV participant APIs | `grpc://localhost:4901`, `grpc://localhost:4902`, `http://localhost:4975` |
| sv Validator API | SV readiness surface | `http://localhost:4903` |
| PostgreSQL | Splice LocalNet DB | `localhost:5432` |

If hostnames do not resolve, add:

```text
127.0.0.1 wallet.localhost scan.localhost sv.localhost
```
