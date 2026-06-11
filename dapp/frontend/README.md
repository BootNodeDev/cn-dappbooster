# vesting-ui

Direct-access dApp for **Canton Coin vesting**: propose a grant, the beneficiary accepts, claim as it vests, or cancel into a residual claim. It talks to a local Canton ledger straight from the browser (no external wallet) through the wallet-service `ledgerApi` proxy, using **explicit disclosure** of an observer-less factory.

Adapted from the static [`cc-vesting-contracts-ui`](https://github.com/BootNodeDev/cc-vesting-contracts-ui) — same pages and look, but its mock wallet and mock store are replaced by a live data layer.

## Parts

| Path | Role |
|------|------|
| `dapp/daml/vesting-lite/` | DAML package `vesting-lite`: observer-less `VestingFactory` → `VestingProposal` → `VestingContract` → residual `VestedClaim`. Linear + milestone curves, real `getTime`. Mirrors the real `cc-vesting-contracts`, minus the LockedAmulet escrow. |
| `src/backend/` | `VestingBackend` interface + `LiteBackend` (ACS reads, command submits, explicit disclosure over the proxy) + `AmuletBackend` (Splice — C2 stub) + `createBackend(mode)`. |
| `src/wallet/` | `DirectWalletProvider`: the party pool, the "acting as" party, and the Lite/Amulet mode. Exposes `useParty` / `useConnect` / `useParties`. |
| `src/store/useVestingStore.ts` | Ledger-backed store; actions submit then refresh. Pure `deriveGrant` + `lib/schedule.ts` mirror the on-ledger math. |
| `src/app/` | Shell: landing party-picker, top-right party-switcher dropdown, mode chip, receiver/funder lens. |
| `src/features/` | Pages: dashboard, proposals, create, grant-detail. |
| `scripts/bootstrap-vesting-lite.mjs` | Creates the operator + party pool + factory; writes `public/vesting-lite-parties.json` (gitignored, deploy-specific). |

## Run

With the local Canton stack running (`./scripts/dev-stack.sh`):

```bash
./scripts/dev-stack.sh vesting-up   # build+deploy the DAR, bootstrap parties, start the dev server
# → http://localhost:3019
```

Manual (DAR already deployed):

```bash
node scripts/bootstrap-vesting-lite.mjs   # writes public/vesting-lite-parties.json
npm run vesting-ui:dev                    # → http://localhost:3019
```

Use the **Create** page's "Quick demo" presets for short (1–2 min) schedules so vesting accrues live during a demo.

## Lite vs Amulet

The mode toggle picks the backend behind the same `VestingBackend` interface:

- **Lite** (now): numeric balances, unfunded grants, on the bare Canton stack. Fully working.
- **Amulet** (C2): real `LockedAmulet` escrow funded from Canton Coin holdings on Splice LocalNet. Same UI — currently offline.
