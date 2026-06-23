# @canton-dappbooster/e2e

Integration tests across the cn-dappbooster's four packages.

- Test the cross-package wiring: dApp ↔ wallet ↔ wallet-gateway-devkit ↔ Canton
- Drive real browser sessions with the Carpincho extension loaded
- Verify wire shapes against the documented public surfaces
- Run deterministically in CI

## Run

### Prerequisites

The full local stack must be running.

### First-time setup

```bash
npm --prefix dapp/e2e install
npm --prefix dapp/e2e run install:browser
```

### Run the tests

```bash
npm --prefix dapp/e2e test           # headless (where the extension support allows)
npm --prefix dapp/e2e run test:headed
npm --prefix dapp/e2e run test:ui    # interactive Playwright UI
npm --prefix dapp/e2e run report     # open the last HTML report
```

From the repo root, keep using the package owner: `npm --prefix dapp/e2e test`.
