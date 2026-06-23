# Architecture

This document explains how the local Canton developer stack is assembled,
configured, and run.

## Components

| Component              | Provided by | Purpose                                                                                                                         |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `canton-barebones`     | this repo   | Docker and Bash wrapper that starts Splice LocalNet when needed, then starts the gateway layer.                                 |
| `wallet-gateway-tools` | this repo   | Public facade over the official wallet-gateway. It adds development RPC helpers and forwards standard gateway traffic upstream. |
| `carpincho-wallet`     | this repo   | Browser wallet and CIP-0103 provider. It stores one gateway URL.                                                                |
| `canton-connect-kit`   | this repo   | React hooks and connector helpers for dApps that talk to a CIP-0103 wallet.                                                     |
| `dapp/frontend`        | this repo   | Example dApp used to exercise the stack.                                                                                        |
| `dapp/daml`            | this repo   | Example DAML package.                                                                                                           |
| Splice LocalNet        | Canton      | Official Splice docker-compose bundle downloaded from Canton releases.                                                          |
| `wallet-gateway`       | Canton      | Official `@canton-network/wallet-gateway-remote` package.                                                                       |

## Runtime Shape

```text
dApp -> canton-connect-kit -> Carpincho
     -> wallet-gateway-tools, usually http://localhost:3011
        -> official wallet-gateway, http://wallet-gateway:3030
        -> Canton / Splice APIs for tools RPC helpers
```

## Docker Composition

`npm run canton:up` starts two layers:

1. Optional Splice LocalNet from the official Splice compose bundle.
2. This repository's gateway layer from `canton-barebones/docker-compose.yaml`.

The Splice bundle is downloaded once into
`~/.canton-dappbooster/splice-localnet` using the tag configured in
`canton-barebones/env/.env.splice`.

The gateway layer adds:

| Service                | Source                                                          | Notes                                                                              |
| ---------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `wallet-gateway`       | official npm package inside `node:24-alpine`                    | Uses `canton-barebones/config/wallet-gateway/config.json`.                         |
| `wallet-gateway-tools` | local Docker build from `canton-barebones/wallet-gateway-tools` | Adds `/tools/*` and JSON-RPC helper methods, and proxies standard gateway traffic. |

Both compose invocations use the `canton-barebones` compose project name, so the
containers appear under one Docker Compose group. They do not share one Docker
network: the official Splice bundle keeps its own `localnet` network, and our
gateway compose file uses its default network. By default, gateway containers use
`host.docker.internal` to reach the Splice ports published by the local bundle.
Remote deployments override those URLs in `env/.env.wallet-gateway-tools`.

## Config Layout

Service config lives under `canton-barebones/`:

| Path                                    | Purpose                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `env/.env.splice`                       | Local Splice bundle tag, cache path, compose project name, and enabled profiles.                       |
| `env/.env.wallet-gateway`               | Public port for the official wallet-gateway.                                                           |
| `env/.env.wallet-gateway-tools`         | Public tools port, Canton/Splice URLs, provider metadata, upstream wallet-gateway URL, and tools auth. |
| `env/examples/`                         | Safe examples for the ignored local env files.                                                         |
| `config/wallet-gateway/config.json`     | JSON config consumed by the official wallet-gateway package.                                           |
| `config/splice/localnet-overrides.yaml` | Small local override applied on top of the official Splice LocalNet compose files.                     |

## Supported Run Modes

| Command                                                 | Starts Splice LocalNet         | Public gateway                      | Use when                                                                  |
| ------------------------------------------------------- | ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| `npm run canton:up`                                     | yes                            | `wallet-gateway-tools` on `3011`    | Default local developer stack.                                            |
| `npm run canton:up -- wallet-gateway`                   | yes                            | official `wallet-gateway` on `3010` | Test the official gateway without tools.                                  |
| `npm run canton:up --no-splice`                         | no                             | selected gateway mode               | Skip local Splice and point at another network, such as DevNet or TestNet. |
| `npm run canton:down`                                   | stops both layers when present | n/a                                 | Stop containers without deleting volumes.                                 |

For remote Splice/Canton deployments, configure:

- `env/.env.wallet-gateway-tools` for tools helper endpoints and auth.
- `config/wallet-gateway/config.json` for the official wallet-gateway network.
- optionally `WALLET_GATEWAY_CONFIG=/path/to/config.json` in the shell before
  running Docker Compose if you do not want to edit the default JSON file.

## Auth Modes

`wallet-gateway-tools` reads auth from
`canton-barebones/env/.env.wallet-gateway-tools`.

| `AUTH_MODE`                | Required variables                                                              | Use when                                                                   |
| -------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `self-signed`              | `AUTH_SECRET`; optional `AUTH_AUDIENCE`, `AUTH_SUBJECT`                         | LocalNet with the default self-signed Canton auth.                         |
| `oauth-client-credentials` | `AUTH_TOKEN_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`; optional `AUTH_SCOPE` | DevNet/TestNet style deployments where tools can mint a JWT through OAuth. |
| `static-token`             | `AUTH_TOKEN`                                                                    | The operator already has a valid JWT and does not want tools to mint one.  |

OAuth tokens are cached in memory and refreshed automatically before expiry.
Static tokens are used as provided. Self-signed tokens are generated once at
startup and do not include an expiration claim. This logic lives in
`canton-barebones/wallet-gateway-tools/src/auth.ts`.

The official wallet-gateway has its own auth/network config in
`config/wallet-gateway/config.json`. Keep it aligned with the same Canton network
that `wallet-gateway-tools` points to, because tools forwards standard gateway
traffic to the official wallet-gateway.

## Local Ports

| Port   | Service                                |
| ------ | -------------------------------------- |
| `3010` | official wallet-gateway public URL     |
| `3011` | wallet-gateway-tools public URL        |
| `3012` | example dApp frontend                  |
| `3013` | Carpincho wallet dev server            |
| `2000` | app-user wallet UI and validator proxy |
| `2901` | app-user Ledger API                    |
| `2902` | app-user Admin API                     |
| `2903` | app-user Validator API                 |
| `2975` | app-user JSON API                      |
| `4000` | Scan UI/API and SV UI host routes      |
| `4901` | SV Ledger API                          |
| `4902` | SV Admin API                           |
| `4903` | SV Validator API                       |
| `4975` | SV JSON API                            |
| `5432` | Splice LocalNet PostgreSQL             |
