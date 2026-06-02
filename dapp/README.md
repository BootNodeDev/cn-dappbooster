# dApp

Minimal dApp split into:

- `daml`: Counter Daml package.
- `frontend`: React dApp that knows the Counter signature and talks to Carpincho through the injected CIP-0103 provider.
- `e2e`: Playwright tests for the dApp integration flow.

The Canton barebones lives in `../canton-barebones`.
