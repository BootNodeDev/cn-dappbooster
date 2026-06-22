# Wallet Gateway Devkit

Express facade that composes the official Canton wallet-gateway with
development helpers for Carpincho and local dApp work.

It is intentionally app-agnostic: app-specific Daml commands come from the
consumer, Carpincho owns signing and approval UI, and this package only handles
Canton connectivity, participant reads, prepared transaction execution,
wallet-internal party onboarding, and helper RPCs useful during development.

`../env/.env.wallet-gateway-devkit` defines the upstream official wallet-gateway.
Unclaimed HTTP routes are proxied there, while devkit keeps its own public port
for helper RPCs.
Carpincho should point only at the devkit RPC URL; Canton, Scan, validator, and
registry URLs are configured in this service, not in the wallet.

## Run

`npm run canton:up` (the root [quick start](../../README.md#quick-start)) brings
wallet-gateway-devkit up alongside Splice LocalNet and the official
wallet-gateway. Verify it from the repo root:

```bash
npm run wallet-gateway-devkit:health
```

## Auth

Real Canton calls require a bearer token accepted by the target participant.
wallet-gateway-devkit owns this auth boundary. It reads endpoints, network id,
provider metadata, auth mode, and secrets directly from
`../env/.env.wallet-gateway-devkit`.

| Mode | Required values |
| --- | --- |
| `self-signed` | `AUTH_SECRET`, optional `AUTH_AUDIENCE`, `AUTH_SUBJECT` |
| `oauth-client-credentials` | `AUTH_TOKEN_URL`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, optional `AUTH_SCOPE` |
| `static-token` | `AUTH_TOKEN` |

## API Boundary

The public dApp surface is CIP-0103. Carpincho exposes that provider to dApps.
wallet-gateway-devkit exposes the HTTP JSON-RPC bridge Carpincho needs at:

```text
POST http://localhost:3011/rpc
```

Devkit also exposes:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Devkit health and active network metadata. |
| `GET /devkit/info` | Devkit provider metadata for local tooling. |

When an upstream wallet-gateway is configured, routes not owned by devkit are
forwarded to that upstream. In localnet devkit mode, `/api/v0/dapp`,
`/api/v0/user`, `/login`, and `/readyz` come from the official wallet-gateway
container. The official wallet-gateway is also public at `http://localhost:3010`.
Carpincho does not need those routes for the current flow; it uses `/rpc` and
lets RPC methods reach the configured Canton stack.

- [CIP-0103 Provider API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#provider-api)
- [CIP-0103 Synchronous dApp API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#synchronous-dapp-api)
- [Vendored OpenRPC dApp API](api-specs/openrpc-dapp-api.json)

Service-specific methods:

| Method               | Caller                          | Purpose                                                                                                          |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prepareTransaction` | Carpincho                       | Calls Canton interactive submission prepare and returns the prepared transaction payload/hash for local signing. |
| `executePrepared`    | Carpincho                       | Submits Carpincho's signature over a prepared transaction to Canton.                                             |
| `ledgerApi`          | Carpincho on behalf of the dApp | Proxies app-user JSON API reads/writes and injects the configured Canton bearer token.                           |

### CIP-56 token methods

These add Canton token-standard reads and transfers plus Amulet (Canton Coin) preapproval. They are token-standard / Amulet logic, not consumer-dApp logic.

| Method | Purpose |
| --- | --- |
| `cip56.listHoldingSummary` | Per-instrument token balance summaries for a party (Amulet summaries via scan proxy; other tokens via holding UTXOs). |
| `cip56.listHoldings` | Raw token holding UTXOs for a party. |
| `cip56.listPendingTransfers` | Pending incoming CIP-56 transfer instructions for a party. |
| `cip56.createTransfer` | Prepares a token transfer for the caller to sign and execute. |
| `cip56.acceptTransfer` | Prepares acceptance of a pending incoming transfer. |
| `amulet.preapproval.status` | Reads the Amulet transfer-preapproval (auto-accept) status for a receiver. |
| `amulet.preapproval.create` | Prepares enabling Amulet auto-accept. |
| `amulet.preapproval.cancel` | Prepares disabling Amulet auto-accept. |
| `amulet.preapproval.acceptProposal` | Accepts a `TransferPreapprovalProposal` for the receiver. |
| `amulet.tap` | Prepares the fixed 100 AMT Splice DevNet faucet tap for a receiver (DevNet only). |

The write methods (`create*`, `acceptTransfer`, `amulet.preapproval.create/cancel/acceptProposal`, `amulet.tap`) return prepared transactions; Carpincho signs locally and submits via `executePrepared`.

`prepareExecute`, `prepareExecuteAndWait`, and `signMessage` stay in
Carpincho because they require the user's key and approval UI.

For `ledgerApi` semantics, read the upstream spec instead of duplicating it:

- [CIP-0103 `ledgerApi`](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#ledgerapi)
- [CIP-0103 JSON Ledger API rationale](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#interoperability-with-the-json-ledger-api)
- [`LedgerApiRequest` schema](api-specs/openrpc-dapp-api.json)

## Admin Endpoints

External party onboarding is wallet/provider operational logic, not generic
dApp API. See
[CIP-0103 topology-related capabilities](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md#topology-related-capabilities).

Carpincho uses these wallet-internal endpoints:

| Endpoint                     | Purpose                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /admin/party/prepare`  | Prepares the external party topology transaction and returns `{ onboardingId, partyId, multiHash }`. |
| `POST /admin/party/complete` | Submits the signed topology transaction, grants user rights, and returns the created party.          |

These endpoints stay outside `/rpc` so the dApp API remains a projection of
the CIP/OpenRPC surface.
