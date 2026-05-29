# Wallet Service

Small Express service that sits between Carpincho and the Canton participant.

The dApp-facing CIP-0103 surface lives in Carpincho over WalletConnect. This service has no private keys, so it exposes the participant bridge Carpincho needs: read the ACS, prepare a transaction hash, and execute a signed prepared transaction.

It is deliberately app-agnostic: no Counter-specific routes live here.

## Run

Primary path — started for you by `npm run canton:up` at the repo root. Verify with:

```bash
npm run wallet-service:health
```

The service self-mints its Canton JWT at boot from `CANTON_AUTH_AUDIENCE`, `CANTON_AUTH_SECRET`, and `CANTON_BACKEND_USER_ID` (all in `canton-barebones/.env`). Set `CANTON_BACKEND_TOKEN` explicitly in the compose env or in this subproject's `.env` to bypass the self-mint.

Host-side dev mode (for mock-mode iteration without Docker):

```bash
npm install
cp .env.example .env
WALLET_SERVICE_MOCK=1 npm run dev
```

Useful checks:

```bash
curl http://localhost:3010/health
curl http://localhost:3010/
curl http://localhost:3010/wallet-service/info
curl -s http://localhost:3010/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"status"}'
```

Expected flow once implemented:

```text
frontend -> carpincho -> wallet-service -> canton participant
```

## API Boundary

CIP-0103 defines the dApp API as a Provider interface:

```ts
provider.request({ method, params })
```

The method names and payload semantics are the standard part. The transport is intentionally open: browser extension `postMessage`, HTTPS, WebSocket, local bridge, etc. This scaffold exposes the Provider over HTTP JSON-RPC 2.0:

```text
POST /rpc
```

Methods use CIP-0103 names, for example:

- `status`
- `connect`
- `isConnected`
- `getActiveNetwork`
- `listAccounts`
- `getPrimaryAccount`
- `prepareExecute`
- `signMessage`
- `ledgerApi`

In this scaffold, `prepareExecute`, `prepareExecuteAndWait`, and `signMessage` are implemented by Carpincho, because Carpincho owns the user key and approval UI. Carpincho then calls two internal service methods:

- `prepareTransaction`: calls Canton interactive submission prepare and returns `preparedTransactionHash`.
- `executePrepared`: submits the signed prepared transaction to Canton.

Counter-specific methods do not belong here. The frontend knows Counter and sends generic Daml commands through CIP-0103; the wallet service only handles Canton connectivity.

For reads, `ledgerApi` is a generic proxy to the Canton participant's JSON API.
The wallet-service injects the bearer token and forwards your request as-is. See
[`api-specs/openrpc-dapp-api.json`](api-specs/openrpc-dapp-api.json) `#/components/schemas/LedgerApiRequest`
for the full param schema (`requestMethod`, `resource`, `body`, `query`, `path`).

External party onboarding/topology work is provider-specific operational logic. CIP-0103 explicitly keeps topology capabilities out of the dApp API, so those should not be exposed as generic dApp methods unless a later standard defines them.

For local onboarding, Carpincho calls two wallet-internal admin endpoints
(not part of the dApp API):

- `POST /admin/party/prepare` with `{ publicKeyBase64, partyHint? }` — prepares
  the external party topology transaction. Returns `{ onboardingId, partyId, multiHash }`.
- `POST /admin/party/complete` with `{ onboardingId, signatureBase64, expectHeavyLoad? }` —
  submits the topology transaction and grants user rights. Returns the created party.

These endpoints are scoped to the wallet (Carpincho is the only caller) and live
off the `/rpc` JSON-RPC surface so the dApp API stays a clean projection of
`openrpc-dapp-api.json`.

## Mock Mode

Set `WALLET_SERVICE_MOCK=1` to short-circuit the dispatcher before any Canton
SDK call. The mock factories in [`src/mock.ts`](src/mock.ts) return the same
`Rpc` and `PartyApi` shapes as their real counterparts, so [`server.ts`](src/server.ts)
swaps them at boot without adapting any HTTP wiring. Useful for wallet-only
iteration with no Docker / Canton / DAML SDK running.

| Surface | Mock behaviour |
| --- | --- |
| `status`, `connect`, `isConnected` | Reports `isConnected: false`, `isNetworkConnected: true`, `networkId: <NETWORK>-mock`. |
| `disconnect` | `null`. |
| `getActiveNetwork` | `{ networkId: <NETWORK>-mock }`. |
| `listAccounts` | `[]`. |
| `getPrimaryAccount` | `-32001 Resource not found`. |
| `prepareTransaction` | Canned `{ preparedTransaction, preparedTransactionHash, hashingSchemeVersion: HASHING_SCHEME_VERSION_V2 }`. |
| `executePrepared` | `{ updateId, completionOffset }` with monotonically increasing offset. |
| `ledgerApi` | Accepts only `POST /v2/state/active-contracts` (the shape the Counter frontend uses) and returns `{ contracts: [] }`. |
| `prepareExecute`, `prepareExecuteAndWait`, `signMessage` | `-32004 Method not supported`. |
| `POST /admin/party/prepare` | Synthesises a `partyId` from `partyHint`, returns `{ onboardingId, partyId, multiHash, topologyTransactions: [] }`. |
| `POST /admin/party/complete` | Looks up the prepared entry and returns `{ partyId }`. |

`GET /health` and `GET /wallet-service/info` report `mock: true` in mock mode.
`CANTON_BACKEND_TOKEN` is not required. Start it directly with:

```bash
WALLET_SERVICE_MOCK=1 npm run dev
```

To exercise carpincho-wallet against the mocked service, run the wallet
separately with `npm --prefix carpincho-wallet run dev`.

## References

- CIP-0103: https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md
- OpenRPC dApp API: https://github.com/canton-network/wallet-gateway/blob/main/api-specs/openrpc-dapp-api.json
