# dApp

Minimal dApp split into three packages:

- [`daml`](daml/README.md): Tally Daml package.
- [`frontend`](frontend/README.md): React dApp that knows the Tally signature and talks to Carpincho through the injected CIP-0103 provider.
- [`e2e`](e2e/README.md): Playwright tests for the dApp integration flow.

The Canton barebones lives in [`../canton-barebones`](../canton-barebones/README.md).

For the shared local loop, follow the root [quick start](../README.md#quick-start).
