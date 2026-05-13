# Counter Wallet Service

Small Express service that sits between Carpincho and the Canton participant.

The dApp-facing CIP-0103 surface lives in Carpincho over WalletConnect. This service has no private keys, so it exposes the participant bridge Carpincho needs: read the ACS, prepare a transaction hash, and execute a signed prepared transaction.

It is deliberately app-agnostic: no Counter-specific routes live here.

## Run

```bash
npm install
cp .env.example .env
npm run dev
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

For reads, `ledgerApi` currently supports the minimal ACS query the Counter frontend uses:

```json
{
  "requestMethod": "post",
  "resource": "/v2/state/active-contracts",
  "body": {
    "parties": ["alice::..."],
    "templateIds": ["#quickstart-counter:Counter.Counter:Counter"]
  }
}
```

External party onboarding/topology work is provider-specific operational logic. CIP-0103 explicitly keeps topology capabilities out of the dApp API, so those should not be exposed as generic dApp methods unless a later standard defines them.

For local onboarding, Carpincho calls two internal service methods:

- `prepareCreateParty`: receives the wallet public key and optional party hint, prepares the external party topology transaction, and returns `onboardingId`, `partyId`, and `multiHash`.
- `completeCreateParty`: receives `onboardingId` plus the wallet signature over `multiHash`, submits the topology transaction, grants user rights, and returns the created party.

References:

- CIP-0103: https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md
- OpenRPC dApp API: https://github.com/canton-network/wallet-gateway/blob/main/api-specs/openrpc-dapp-api.json
