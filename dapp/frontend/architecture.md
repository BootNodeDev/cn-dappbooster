# Architecture Overview

<!-- Keep this document up to date as the system evolves. It captures structural
     knowledge that helps both humans onboarding and agents building context at
     session start. Focus on the "shape" of the system — not usage instructions
     (that's CLAUDE.md) or API docs (that's code comments). -->

This is a **live** frontend for the
[`cc-vesting-contracts`](https://github.com/BootNodeDev/cc-vesting-contracts) vesting app
(DAML/Canton; token is Splice Amulet / Canton Coin). It talks to a real ledger: reads of the
Active Contract Set and command submission go through the wallet-service `ledgerApi`/`scanApi`
JSON-RPC proxy. Both the wallet and the ledger sit behind a swappable backend boundary
(`src/backend/`, `src/wallet/`) so the integration surface stays isolated from the UI.

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Framework | React 19 | Function components only |
| Build tool | Vite 6 | `@vitejs/plugin-react`, `@tailwindcss/vite` |
| Language | TypeScript 5 (strict) | No semicolons; single quotes (Biome) |
| Routing | React Router 7 | `createBrowserRouter`; pages lazy-loaded |
| State | Zustand 5 | Domain store + UI store |
| Styling | Tailwind CSS v4 | CSS-first `@theme inline`, no `tailwind.config` |
| UI primitives | In-house | No component library |
| Testing | Vitest 3 | Unit tests for vesting math + helpers |
| Lint/format | Biome 2 | Husky + lint-staged + commitlint |
| Fonts | Manrope, JetBrains Mono | `@fontsource-variable/*` |
| Runtime | Node `>=24` | npm (root workspaces) |

## Project Structure

```
src/
  main.tsx               App entry; mounts <App/>, imports global CSS
  App.tsx                Provider stack (Theme → Wallet → Router) + Toaster
  routes.tsx             Route table (AppShell layout + 3 lazy-loaded pages)
  app/                   Application chrome
    AppShell.tsx         Gates on wallet (ConnectScreen when disconnected); TopBar + Suspense Outlet
    ConnectScreen.tsx    Landing party picker (enters the app on select)
    TopBar.tsx           Logo/title + ThemeToggle + WalletControl
    WalletControl.tsx    Party switcher: acting-party pill + pool menu (copy id, sign out)
    ThemeToggle.tsx      Light ⇄ dark
  backend/               Swappable ledger boundary
    VestingBackend.ts    Backend interface + row→domain mappers
    AmuletBackend.ts     Live backend: ACS reads + scan service + explicitly-disclosed commands
    amuletCommands.ts    AmuletVesting choice command builders
    commands.ts          Disclosure shaping + curve encode/decode (pure)
    createBackend.ts     Builds the active backend from runtime config
    ledgerApi.ts         JSON-RPC client for the wallet-service proxy
  components/            Reusable UI (Card, Button, KpiCard, GrantCard, GrantTable, ScheduleBar,
                         ScheduleCurve, MilestoneTimeline, StatusPill, AmountDisplay, Legend,
                         ClaimDialog, Modal, TokenAmountField, CcCoin, PartyAvatar, InfoTooltip,
                         EmptyState, Spinner, toast, icons)
  features/             One folder per screen
    dashboard/           KPIs + grant cards/table + residual claims + claim/cancel dialogs
    create/              Create-grant form with live schedule-curve preview
    grant-detail/        Single grant: curve, milestones, parties, history, actions
  store/                Domain model + state
    types.ts             Grant / Proposal / VestedClaim / Role (mirror DAML templates)
    useVestingStore.ts   Zustand store; actions ≙ choices; deriveGrant() projection; status helpers
    useUiStore.ts        Dashboard view (cards/table)
  lib/                  Pure utilities
    schedule.ts          Vesting math + re-lock helpers, ports AmuletVesting.Schedule
    format.ts            CC amounts, party ids, dates, relative time
    clock.ts             Shared 1s "now" clock (useNow) for live accrual
    clipboard.ts         copyPartyId (clipboard write + toast)
    cn.ts                className joiner
    uuid.ts              Secure-context-safe UUID with fallback
    motion.ts            Shared framer-motion variants
  wallet/               Wallet boundary (wallet-service client)
    Wallet.ts            Wallet interface (listParties / execute)
    StealthWallet.ts     Hosted wallet over the wallet-service (listAccounts + ledgerApi submit)
    WalletProvider.tsx   Connect/party/pool context + backend wiring
    hooks.ts             useParty / useConnect / useParties / useBackend
  theme/                ThemeProvider.tsx + tokens.css (dual-mode design tokens)
  styles/index.css      Tailwind import + @theme inline mapping + base styles
```

## Key Abstractions

- **`deriveGrant(grant, nowMs)`** (`store/useVestingStore.ts`) — the single projection that
  turns a stored grant + the current time into `{ fraction, vested, claimable, claimed,
  unvested, status }`. Every screen reads figures from here; nothing recomputes vesting inline.
  `statusPillLabel` / `statusPillTone` derive the shared status chip from that status.
- **Vesting math** (`lib/schedule.ts`) — `vestedFraction` / `vestedAmount` /
  `validVestingSchedule` / `MIN_GRANT_AMOUNT`, a direct port of `AmuletVesting.Schedule`
  (linear + milestone + true cliff). `canClaim` / `remainderAfter` / `floorOk` mirror the
  on-ledger re-lock floor so the UI never offers a withdraw the contract will reject. Pure and
  unit-tested.
- **Identity + tabs** — the connected wallet party is the actor (chosen in `WalletControl`).
  The dashboard's per-escrow tabs (`received` vs `created`) only change which side of the
  user's own escrows is shown; they never change identity.

### Data Access Layer

Two swap points isolate integration from the UI:

1. **Wallet** — `src/wallet/` defines a `Wallet` interface; `StealthWallet` implements it over
   the wallet-service (`listAccounts` for the CanActAs pool, `ledgerApi` submit for commands —
   no signing popup). Components only import from `@/wallet`.
2. **Ledger** — `src/backend/` defines `VestingBackend`; `AmuletBackend` implements it against
   Splice LocalNet. It reads the ACS via the wallet-service `ledgerApi` proxy, fetches
   `AmuletRules` + the latest opened `OpenMiningRound` from the `scanApi`, and builds commands
   that carry an explicitly-disclosed `AppTransferContext` on every mutating choice. Components
   call store actions and read derived selectors; they never construct commands directly.

## Routes

| Route | Module | Description |
|-------|--------|-------------|
| `/` | `routes.tsx` | Redirects to `/dashboard` |
| `/dashboard` | `features/dashboard/DashboardPage` | KPIs + grants (cards/table) + pending proposals + residual claims |
| `/create` | `features/create/CreateGrantPage` | Create-grant form + live schedule preview |
| `/grants/:id` | `features/grant-detail/GrantDetailPage` | Curve, milestones, parties, history, actions |

Pages are `React.lazy`-loaded; `AppShell` renders `ConnectScreen` when disconnected, otherwise
the top bar + a `<Suspense>`-wrapped `<Outlet/>` (full-screen spinner fallback) under `<main>`.

## Data Flow

```
wallet-service (ledgerApi + scanApi)  ─▶  AmuletBackend  ─▶  useVestingStore (Zustand)  ─▶  deriveGrant(grant, now)  ─▶  UI
                                              ▲                      ▲                              ▲
              StealthWallet.execute() submits commands       refresh() re-reads ACS        useNow() ticks 1s → live accrual
                                              ▲
                    store actions (withdraw / cancel / accept / createVesting / claimResidual)
```

The connected party comes from `useParty()`; the dashboard tabs filter which of the user's
escrows show. There is no caching layer beyond the in-memory Zustand store; re-renders are
driven by Zustand subscriptions plus the shared clock.

## Environment Variables

The app reads no `import.meta.env` at runtime. Live wiring comes from a runtime config file
fetched at startup (`/public/amulet-parties.json`): `rpcUrl` (wallet-service proxy), `pkg`
(amulet-vesting package id), `operator` (app-provider party), and optional `splicePkg`.

## Scripts

| Command | Purpose |
|---------|---------|
| `dev` | Vite dev server with HMR |
| `build` | `tsc -b` then `vite build` to `dist/` |
| `preview` | Serve the built `dist/` |
| `test` | Vitest unit tests |
| `lint` / `lint:fix` | Biome check (write) |
| `typecheck` | `tsc -b --noEmit` |

---

## Domain-Specific Sections

### Number / Precision Handling

Amounts are Canton Coin (CC), modeled on DAML `Decimal` (fixed-point, up to 10 fractional
digits on-ledger). The UI works in JavaScript numbers for display only and formats via
`lib/format.ts` (`formatCC`, grouped, ≤2 decimals; `formatCCFull` for exact figures).
`MIN_GRANT_AMOUNT = 1.0` is enforced for new grants and for the re-lock floor on partial
withdrawals/cancels, matching the contract. Amounts and party ids always render in JetBrains
Mono.

### Smart Contract Architecture

The UI mirrors three DAML templates and their choices (see `store/types.ts`):

- `Grant` ≙ `AmuletVestingContract`, `Proposal` ≙ `AmuletVestingProposal`,
  `VestedClaim` ≙ `AmuletVestedClaim`.
- Origination: `AmuletVestingFactory` → `CreateVesting` → `Proposal` → receiver `Accept`
  funds a single `LockedAmulet` escrow → live `Grant`.
- Lifecycle: receiver `Withdraw` (cliff-gated, partial, over-withdraw guarded); funder
  `Cancel` (unvested → funder, vested-but-unclaimed → `VestedClaim`); receiver claims the
  residual with no cliff.
- `dso` is never a UI actor; escrow funding inputs (`amuletCids`) are selected live from the
  proposer's own Amulet holdings in the create form.
