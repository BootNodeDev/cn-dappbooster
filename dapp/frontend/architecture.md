# Architecture Overview

<!-- Keep this document up to date as the system evolves. It captures structural
     knowledge that helps both humans onboarding and agents building context at
     session start. Focus on the "shape" of the system — not usage instructions
     (that's CLAUDE.md) or API docs (that's code comments). -->

This is a **static, mocked-data** frontend for the
[`cc-vesting-contracts`](https://github.com/BootNodeDev/cc-vesting-contracts) vesting app
(DAML/Canton; token is Splice Amulet / Canton Coin). There is no backend and no live ledger
yet. An in-memory store stands in for the Active Contract Set, and the wallet is mocked. Both
layers deliberately mirror the eventual integration surface so they can be swapped in place.

## Tech Stack

| Category | Technology | Notes |
|----------|-----------|-------|
| Framework | React 19 | Function components only |
| Build tool | Vite 6 | `@vitejs/plugin-react`, `@tailwindcss/vite` |
| Language | TypeScript 5 (strict) | No semicolons; single quotes (Biome) |
| Routing | React Router 7 | `createBrowserRouter` |
| State | Zustand 5 | Mock domain store + UI store |
| Styling | Tailwind CSS v4 | CSS-first `@theme inline`, no `tailwind.config` |
| UI primitives | In-house | No component library |
| Testing | Vitest 3 | Unit tests for vesting math |
| Lint/format | Biome 2 | Husky + lint-staged + commitlint |
| Fonts | Manrope, JetBrains Mono | `@fontsource-variable/*` |
| Runtime | Node `>=24` | pnpm |

## Project Structure

```
src/
  main.tsx               App entry; mounts <App/>, imports global CSS
  App.tsx                Provider stack (Theme → Wallet → Router) + Toaster
  routes.tsx             Route table (AppShell layout + 4 pages)
  app/                   Application chrome
    AppShell.tsx         Gates on wallet (connect/locked) then renders Sidebar + TopBar + Outlet
    Sidebar.tsx          Left nav (Dashboard/Proposals/Create) + proposal badge
    TopBar.tsx           Title/crumb + RoleToggle + ThemeToggle + WalletControl
    ConnectScreen.tsx    Pre-connection welcome (Carpincho / WalletConnect)
    WalletControl.tsx    Connect dropdown / connected-party account menu
    RoleToggle.tsx       Receiver ⇄ Funder view lens
    ThemeToggle.tsx      Light ⇄ dark
  components/            Reusable UI (Card, Button, KpiCard, GrantCard, GrantTable,
                         ScheduleBar, ScheduleCurve, MilestoneTimeline, StatusPill,
                         AmountDisplay, Legend, ClaimDialog, Modal, ProposalCard,
                         EmptyState, toast, icons)
  features/             One folder per screen
    dashboard/           KPIs + grant cards/table + residual claims + claim/cancel dialogs
    proposals/           Incoming/outgoing proposals (accept/decline)
    create/              Create-grant form with live schedule-curve preview
    grant-detail/        Single grant: curve, milestones, parties, history, actions
  store/                Domain model + state
    types.ts             Grant / Proposal / VestedClaim / Role (mirror DAML templates)
    mockData.ts          Seed ACS + demo parties (PARTIES.me is the connected party)
    useVestingStore.ts   Zustand store; actions ≙ choices; deriveGrant() projection
    useUiStore.ts        Role + dashboard view (cards/table)
  lib/                  Pure utilities
    schedule.ts          Vesting math, ports AmuletVesting.Schedule
    format.ts            CC amounts, party ids, dates, relative time
    clock.ts             Shared 1s "now" clock (useNow) for live accrual
    cn.ts                className joiner
  wallet/               Mocked CIP-0103 wallet (mirrors canton-connect-kit)
    types.ts, WalletProvider.tsx, hooks.ts
  theme/                tokens.css (dual-mode design tokens) + ThemeProvider.tsx
  styles/index.css      Tailwind import + @theme inline mapping + base styles
```

## Key Abstractions

- **`deriveGrant(grant, nowMs)`** (`store/useVestingStore.ts`) — the single projection that
  turns a stored grant + the current time into `{ fraction, vested, claimable, claimed,
  unvested, status }`. Every screen reads figures from here; nothing recomputes vesting inline.
- **Vesting math** (`lib/schedule.ts`) — `vestedFraction` / `vestedAmount` /
  `validVestingSchedule` / `MIN_GRANT_AMOUNT`, a direct port of `AmuletVesting.Schedule`
  (linear + milestone + true cliff). Kept pure and unit-tested.
- **Role as a lens** — the connected wallet party is the actor; `useUiStore.role`
  (`receiver` | `funder`) only changes which grants are shown (receiver === party vs
  creator === party) and which actions render.

### Data Access Layer

Two swap points isolate the mock from the eventual integration:

1. **Wallet** — `src/wallet/` reproduces the public hook API of
   `bn-canton-dev-stack`'s `canton-connect-kit` (`useConnect`, `useParty`, `useWalletStatus`,
   `useExecute`, and `WalletProvider` ≙ `ConnectKitProvider`). The connector is mocked
   (instant connect as a demo party, simulated lock + sign→execute lifecycle). Components only
   import from `@/wallet`; swapping to the real package needs no UI changes. Carpincho
   (browser extension) is the primary connect path; WalletConnect is secondary.
2. **Ledger** — `useVestingStore` is the in-memory ACS. Actions (`withdraw`, `cancel`,
   `accept`, `createVesting`, `claimResidual`) mutate state in place; a real client would
   submit a command and refresh from the ledger. Components never construct grants directly —
   they call store actions and read derived selectors.

## Routes

| Route | Module | Description |
|-------|--------|-------------|
| `/` | `routes.tsx` | Redirects to `/dashboard` |
| `/dashboard` | `features/dashboard/DashboardPage` | KPIs + grants (cards/table) + residual claims |
| `/proposals` | `features/proposals/ProposalsPage` | Incoming (accept/decline) or outgoing proposals |
| `/create` | `features/create/CreateGrantPage` | Create-grant form + live schedule preview |
| `/grants/:id` | `features/grant-detail/GrantDetailPage` | Curve, milestones, parties, history, actions |

`AppShell` wraps all routes: it renders `ConnectScreen` when disconnected, a locked notice
when the wallet is locked, otherwise the sidebar + top bar + `<Outlet/>`.

## Data Flow

```
mockData (seed ACS)  ─▶  useVestingStore (Zustand)  ─▶  deriveGrant(grant, now)  ─▶  UI
                              ▲                              ▲
        actions (withdraw/cancel/accept/create)        useNow() ticks 1s → live accrual
                              ▲
        useExecute() (mocked Carpincho sign→execute) gates write actions
```

The connected party comes from `useParty()`; `useUiStore.role` filters which grants each
screen shows. There is no caching layer — state is a single in-memory store and re-renders are
driven by Zustand subscriptions plus the shared clock.

## Environment Variables

None. The app is fully static and mocked; nothing reads `import.meta.env` at runtime.

## Scripts

| Command | Purpose |
|---------|---------|
| `dev` | Vite dev server with HMR |
| `build` | `tsc -b` then `vite build` to `dist/` |
| `preview` | Serve the built `dist/` |
| `test` | Vitest unit tests (vesting math) |
| `lint` / `lint:fix` | Biome check (write) |
| `typecheck` | `tsc -b --noEmit` |

---

## Domain-Specific Sections

### Number / Precision Handling

Amounts are Canton Coin (CC), modeled on DAML `Decimal` (fixed-point, up to 10 fractional
digits on-ledger). The UI works in JavaScript numbers for display only and formats via
`lib/format.ts` (`formatCC`, grouped, ≤2 decimals). `MIN_GRANT_AMOUNT = 1.0` is enforced for
new grants and for the re-lock floor on partial withdrawals/cancels, matching the contract.
Amounts and party ids always render in JetBrains Mono.

### Smart Contract Architecture (target integration)

The UI mirrors four DAML templates and their choices (see `store/types.ts`):

- `Grant` ≙ `AmuletVestingContract`, `Proposal` ≙ `AmuletVestingProposal`,
  `VestedClaim` ≙ `AmuletVestedClaim`.
- Origination: `AmuletVestingFactory` → `CreateVesting` → `Proposal` → receiver `Accept`
  funds a single `LockedAmulet` escrow → live `Grant`.
- Lifecycle: receiver `Withdraw` (cliff-gated, partial, over-withdraw guarded); funder
  `Cancel` (unvested → funder, vested-but-unclaimed → `VestedClaim`); receiver claims the
  residual with no cliff.
- `dso` is never a UI actor; escrow funding inputs (`amuletCids`) are represented as the
  mocked "fund source" in the create form.
