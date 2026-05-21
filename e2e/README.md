# @canton-counter/e2e

Integration tests across the canton-counter scaffold's four packages.

## What this package does (and doesn't)

**Does:**
- Test the cross-package wiring: dApp ↔ wallet ↔ wallet-service ↔ Canton
- Drive real browser sessions with the Carpincho extension loaded
- Verify wire shapes against the documented public surfaces
- Run deterministically in CI

**Doesn't:**
- Test internals of any individual package (each owns its own unit tests)
- Import source from other packages — this is a strict black-box consumer
- Manage the lifecycle of Canton, wallet-service, Carpincho, or the dApp directly. Bring them up via their own `dev` / `start` scripts before running tests; e2e just consumes their stable surfaces

## Monorepo / publishing notes

This package depends on **nothing in this repo** at the TypeScript level. Every cross-package touch goes through one of three doors:

| Door | Default | Override |
|---|---|---|
| wallet-service HTTP | `http://localhost:3010` | `WALLET_SERVICE_URL` |
| Carpincho web | `http://localhost:3011` | `CARPINCHO_URL` |
| Counter dApp | `http://localhost:3012` | `DAPP_URL` |
| Carpincho extension bundle | `../carpincho-wallet/dist-extension` | `EXTENSION_PATH` |

When the four packages publish independently and the dev kit becomes a monorepo of NPM workspaces, these env-overrides let e2e target either:
- the in-tree dev stack (default),
- a `node_modules/@canton-counter/*` install,
- a remote staging environment.

## Run

### Prerequisites

The full local stack must be running. From the repo root:

```bash
# In four terminals — see the root README §1–6 for the canonical bring-up
npm run canton:up && npm run canton:health
npm run --silent canton:token > /tmp/canton.token
sed -i '' "s|^CANTON_BACKEND_TOKEN=.*|CANTON_BACKEND_TOKEN=$(cat /tmp/canton.token)|" counter/wallet-service/.env
./canton-base/scripts/deploy-dar.sh counter/daml/.daml/dist/quickstart-counter-0.0.1.dar
npm --prefix carpincho-wallet run build:extension
npm run wallet-service:dev      # terminal 1
npm run wallet:dev              # terminal 2
npm run app:dev                 # terminal 3
```

### First-time setup

```bash
npm --prefix e2e install
npm --prefix e2e run install:browser
```

### Run the tests

```bash
npm --prefix e2e test           # headless (where the extension support allows)
npm --prefix e2e run test:headed
npm --prefix e2e run test:ui    # interactive Playwright UI
npm --prefix e2e run report     # open the last HTML report
```

Or from the repo root: `npm run e2e`.

## What's tested today

**Boundary smoke (`tests/smoke.spec.ts`)** — fast (<2s each):
1. wallet-service `/health` responds with the configured service
2. wallet-service `/wallet-service/info` exposes the dapp-api surface (10 supportedMethods, two admin endpoints, three reserved methods)
3. counter dApp loads and offers both connect paths (extension + WC fallback)
4. Carpincho extension is discoverable from a dApp page via `canton:requestProvider` / `canton:announceProvider`

**`/rpc` spec conformance (`tests/spec-conformance.spec.ts`)** — guards the wire shape:
- `ledgerApi` returns the raw participant response (no `{response, status}` or `{contracts}` wrapping)
- `ledgerApi` rejects non-native bodies with `-32000` rather than silently translating
- Native ACS body shape works end-to-end against Canton
- Removed dapp-api methods (`prepareCreateParty`, `completeCreateParty`) stay `-32601`
- Reserved methods (`prepareExecute`, `prepareExecuteAndWait`, `signMessage`) stay `-32004`

**Full dApp ↔ wallet flows** (each walks vault setup → party create → dApp connect → action):
- `tests/sign-message.spec.ts` — `signMessage` round-trips a base64 signature
- `tests/accounts-changed.spec.ts` — switching primary in Carpincho propagates to the dApp via `accountsChanged`
- `tests/tx-changed.spec.ts` — captures the full `pending → signed → executed` lifecycle during `prepareExecuteAndWait`

**12 tests total.** All deterministic via `data-testid` + `data-*` attribute reads, no sleep guesses.

## Not tested today (out of scope)

- WC fallback path (would need a real Reown project ID)
- Counter dApp's Increment / Add user / Add viewer flows (covered manually via agent-browser; could add Playwright if we want full UI coverage)
- `connected` and `statusChanged` are emitted by the wallet on vault lifecycle transitions but no dApp surface consumes them yet, so there is no e2e test for them. `messageSignature` lifecycle events are not emitted (`signMessage` is request/response via the Promise; lifecycle events would have no consumer).

## Conventions

- One spec file per integration concern (`smoke`, `party-onboarding`, `counter`, `spec-conformance`)
- Use `data-testid` selectors via `page.getByTestId(...)`. Avoid CSS-by-position or text-only locators — they break on UI tweaks
- Tests must be runnable individually (no order dependencies)
- Each test starts from a known browser context (the `context` fixture gives a fresh persistent profile per test)
- Don't add `expect`s that depend on heuristic sleeps — use `expect.poll` or wait-for assertions

## When this package owns the lifecycle

Phase 1 deliberately requires the stack to be up beforehand. This keeps the boundary clean — the package isn't a sidecar deployment tool. If we later want one-command CI that brings everything up, the right move is either:
- a `globalSetup` script in `playwright.config.ts` that shells out to `npm run canton:up && …` (acceptable in dev / CI)
- a docker-compose meta-service that pre-stages all four packages (more invasive, monorepo-friendly)

Both can be layered later without changing tests.
