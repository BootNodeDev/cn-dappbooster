# Agent Configuration — dapp/e2e

This file applies only to `dapp/e2e/`. For monorepo-wide rules, see [`../../AGENTS.md`](../../AGENTS.md).

## Scope

`dapp/e2e` is a black-box Playwright package. It tests cross-package wiring through stable surfaces: wallet-gateway-devkit HTTP, the loaded Carpincho extension, the dApp UI, and browser-visible provider events.

## Working Rules

- Do not import source from `carpincho-wallet/`, `canton-barebones/`, `canton-connect-kit/`, or `dapp/frontend/`.
- Do not make e2e own stack lifecycle unless the README and Playwright config are explicitly changed together.
- Use env overrides (`WALLET_GATEWAY_DEVKIT_URL`, `DAPP_URL`, `EXTENSION_PATH`) instead of hard-coding alternate targets.
- Prefer `data-testid` selectors and stable `data-*` attributes. Avoid CSS position selectors and broad text-only locators.
- Avoid heuristic sleeps. Use Playwright waits, `expect.poll`, or assertions that wait on observable state.
- Keep tests runnable independently. Do not rely on test order or shared browser state.

## Testing

- Run tests with `npm test` from this package, or `npm --prefix dapp/e2e test` from the repo root.
- Use headed or UI mode only for debugging: `npm run test:headed` or `npm run test:ui`.
- Keep each spec focused on one integration concern.

## Validation Checklist

- `npm run lint`
- `npm test` when the full local stack is running
