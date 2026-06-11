# dApp

Minimal dApp split into:

- `daml/vesting-lite`: vesting-lite Daml package.
- `frontend`: React dApp (vesting UI, port 3012) that implements the vesting-lite signature. Direct-access: talks to the wallet-service over JSON-RPC (no injected CIP-0103 provider).
- `e2e`: Playwright tests for the dApp integration flow.

The Canton barebones lives in `../canton-barebones`.

For the shared local loop, follow the root [quick start](../README.md#quick-start).
