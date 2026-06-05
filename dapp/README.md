# dApp

Minimal dApp split into:

- `daml`: Tally Daml package.
- `frontend`: React dApp that knows the Tally signature and talks to Carpincho through the injected CIP-0103 provider.
- `e2e`: Playwright tests for the dApp integration flow.

The Canton barebones lives in `../canton-barebones`.

For the shared local loop, follow the root [quick start](../README.md#quick-start).
