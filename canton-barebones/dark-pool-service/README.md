# Dark Pool Service (`@canton-dappbooster/dark-pool-service`)

Off-ledger backend for the CN Dark Pool: a single Express 5 + TypeScript process that drives the deployed `dark-pool` Daml contracts on Canton. It serves the trader/venue REST API, runs a pure matching engine on a schedule, and settles crossing orders on-ledger via `DarkPool_Match`.

**Status (2026-06-13):** Implemented and **green — 33/33 tests pass** (units + a mock place→match→settle integration), typecheck clean. The two DARs (`dark-pool`, `registry-token`) are built and deployed to the local Splice LocalNet. **The service has been proven against an in-memory mock ledger only — not yet exercised end-to-end against the live JSON Ledger API, not containerized, not on FiveNorth/DO.** See [Done / Missing / Continue](#done--missing--how-to-continue).

---

## 1. What it is & why (architecture)

- **Custodial, co-hosted v1.** One backend holds one bearer token and `actAs`/`readAs` the venue, the token-admin, and the trader parties. No per-trader keys, no SIWE — a caller passes a `partyId` in plaintext. (Auth is an explicit non-goal for v1; deferred.)
- **Single process.** The matcher is an in-process scheduled pass, not a second daemon. Simpler to run and deploy at this volume; the spec notes the two-process split as a later scaling step.
- **The ledger is the source of truth.** No database. An in-memory projection (polled ACS + tx-history-derived trades) backs fast reads and is rebuilt on boot. Nothing the system needs is held only in the backend.
- **The matcher is a pure function whose postconditions equal the contract's preconditions.** `findMatches(pool, orders, now) → MatchPlan[]` only ever emits pairs that already satisfy every on-ledger guard (opposite sides, distinct traders, `buyLimit ≥ sellLimit`, `fillQty = min(qty)`, both `minFill`s). So a settlement failure means a genuine race (stale funding), never a logic bug. This is the critical, fully-unit-tested core.
- **One admin-scoped registry token.** A single `RegistryRules` contract per token admin is *both* the faucet (`Mint {symbol,to,amount}`) *and* the `AllocationFactory` for every instrument under that admin. Settlement passes that one `factoryCid` for both legs. (CIP-56 can't be settled by the dark pool — it implements `TransferInstruction`, not `AllocationFactory` — so we trade our own registry token.)

## 2. Where things are (module map)

`src/`
- `config.ts` — resolves `Config` from `dark-pool.bootstrap.json` (or the mock fixture) + env; picks the auth source.
- `auth.ts` — bearer-token provider: `static` (LocalNet `CANTON_BACKEND_TOKEN`), `m2m` (FiveNorth `client_credentials`, refresh-ahead), or `mock`.
- `ledger.ts` — JSON Ledger API v2 client: `submit(actAs, commands)`, `activeContracts`, `ledgerEnd`, `updates`, + `createdCid`/`exerciseResult` helpers.
- `mockLedger.ts` + `mock-bootstrap.json` — in-memory ledger + seeded fixture for offline runs/tests.
- `decimal.ts` — exact 10-dp arithmetic (scaled BigInt) mirroring on-ledger `DarkPool.Math` (`floorTo10`, `crosses`, `fillQuantity`, `quoteAmount`, `remainderQuantity`).
- `matcher.ts` — pure price-time matcher.
- `funding.ts` — select a party's holdings to cover the worst-case funding bound.
- `projection.ts` — ACS → in-memory caches + pure reducers (`toBalances`, `bookFor`, `myOrders`).
- `settlement.ts` — build + submit `DarkPool_Match`, record the trade, fail-closed on stale funding.
- `scheduler.ts` — guarded `runPass()` (single writer), 5-min heartbeat + manual trigger + runtime-reconfigurable interval.
- `commands.ts` — pure JSON command builders (`placeOrder`/`cancelOrder`/`match`/`mint`).
- `http.ts` — Express routes (§4). `server.ts` / `wiring.ts` — bootstrap & dependency wiring. `types.ts` — contract + DTO types.

`test/` — `decimal`, `matcher`, `funding`, `projection`, `commands`, `settlement` unit tests + `integration/match.test.ts` (mock place→match→settle→cancel→expiry).

The Daml lives at repo-root `daml/dark-pool` (vendored, unchanged) and `daml/registry-token` (our token). Bootstrap tooling: `canton-barebones/scripts/dark-pool-bootstrap.mjs`.

## 3. How to run

**Mock mode — offline, zero setup (use this for frontend dev & demos without Canton):**
```bash
DARK_POOL_MOCK=1 npm --prefix canton-barebones/dark-pool-service run dev
# → http://localhost:3020, seeded from src/mock-bootstrap.json, no token/ledger needed
```
`POST /venue/match` settles seeded crossing orders in-memory; every endpoint works.

**Against the local Splice LocalNet (real ledger):** requires Phase B first — deploy the DARs and bootstrap (see §7). Then:
```bash
CANTON_BACKEND_TOKEN=$(grep -E '^CANTON_BACKEND_TOKEN=' canton-barebones/.env | cut -d= -f2-) \
CANTON_JSON_API_URL=http://localhost:2975 \
DARK_POOL_BOOTSTRAP=daml/dark-pool.bootstrap.json \
npm --prefix canton-barebones/dark-pool-service run dev
```

**Auth precedence** (`config.ts`): `DARK_POOL_MOCK=1` → mock; else `CANTON_BACKEND_TOKEN` → static (LocalNet); else `FIVENORTH_CLIENT_SECRET` → M2M (FiveNorth); else it throws with guidance.

## 4. API reference (what the frontend consumes)

All JSON. Port `3020` (`DARK_POOL_SERVICE_PORT`). Shapes are built to map onto the frontend's existing `DarkPoolClient` types.

| Method · path | Body / query | Returns |
| --- | --- | --- |
| `GET /healthz`, `/readyz` | — | `{status}` |
| `GET /venue` | — | `{ pools: { [poolId]: { pool, book:[Order], trades:[Trade], stats } }, schedule:{intervalMs,nextRunAt} }` — operator view, **full book** |
| `GET /trade?party=` | `party` | `{ pools:[Pool], orders:[Order], fills:[Fill], balances:[Balance] }` — **own orders only** |
| `POST /faucet` | `{ party, instrument?, amount? }` | `{ balances }` — mints `instrument` (default base, `amount` default `1000.0`) to `party` |
| `POST /orders` | `{ party, side, quantity, limitPrice, minFill, poolId?, expiresAt? }` | `201 { order }` — selects funding, places as `party` |
| `DELETE /orders/:cid` | `{ party }` | `{ cancelled }` |
| `POST /venue/match` | — | `{ ranAt, matched:[…], rejected:[…], schedule }` — runs a matching pass now, re-arms the timer |
| `PUT /venue/schedule` | `{ intervalMs }` | `{ intervalMs, nextRunAt }` — bounds `[1s, 24h]` |

DTO shapes (`http.ts`): `Order = { cid, poolId, side:'Buy'|'Sell', quantity, limitPrice, minFill, submittedAt, expiresAt }`; `Fill = { tradeId, poolId, side, price, quantity, settledAt }`; `Trade = { tradeId, poolId, price, quantity, buyer, seller, settledAt }`; `Balance = { instrument, total, declared }`. All amounts/prices are decimal **strings**. `submittedAt` is the ledger **creation offset** (a monotonic ordering key, not a wall-clock ms — see [Assumptions](#6-assumptions--decisions)).

## 5. How to test

```bash
npm --prefix canton-barebones/dark-pool-service test     # 33/33 pass
```
Covers (all against fakes / the mock ledger, no network): decimal exactness vs `floorTo10`; matcher (cross, no-cross, self-match, min-fill skip, price-time ordering, expiry, one-sell-per-buy); funding selection (exact/over/insufficient); projection reducers (`total`, `declared`, isolation); settlement (submits `DarkPool_Match`, records the trade, fail-closed on error); and the end-to-end **mock** integration (place→match→settle moves balances, cancel, expiry sweep). Lint/format: `npm --prefix canton-barebones/dark-pool-service run lint` (Biome).

The **live-ledger** equivalent of the integration test is the main thing still to run (see §7).

## 6. Assumptions & decisions

- **Co-hosted custody:** the M2M user can `actAs` venue/admin/traders. Unverified on FiveNorth (Risk #1) — the bootstrap run is the test.
- **`/orders` needs a co-hosted party** (the backend acts *as* it). Reads (`/venue`, `/trade`) and `/faucet` work for any partyId, including an external wallet party. Wallet-signed external placement is deferred.
- **Darkness:** `/venue` exposes the whole book (operator), `/trade` returns only the caller's own orders; pool *configs* are public in both. Don't surface other traders' orders in the trade view.
- **`submittedAt` is the ledger offset**, not a timestamp — the on-ledger `Order` carries none. Treat it as an ordering key; if the UI needs wall-clock, derive it elsewhere or add a created-at mapping.
- **Single `factoryCid` for both legs** (admin-scoped registry). Both base and quote must share the same token admin.
- **Decimals are strings end-to-end**, computed as scaled BigInt to match `floorTo10` exactly — never JS floats.
- **Trades** are recorded live at settlement; on restart they're rehydrated from a tx-history scan (interim: empty on boot — display-only, the ledger holds the truth).
- **Settlement context** uses `emptyExtraArgs` and (co-hosted) attaches no disclosures — both to be confirmed at the first live run.

## 7. Done / Missing / How to continue

**Done:** Daml (`dark-pool` + `registry-token`) built & deployed to LocalNet; the full service + 33/33 tests; mock-mode end-to-end.

**Missing / next (in order):**
1. **Phase B on the live LocalNet (~10 min)** — out of scope for this delivery but the immediate next step. The DARs are already deployed; run:
   ```bash
   node --env-file=canton-barebones/.env canton-barebones/scripts/dark-pool-bootstrap.mjs
   ```
   It allocates parties, creates the pool + the single registry factory, mints seed holdings, and writes `daml/dark-pool.bootstrap.json` (the service's real config). **This also proves the M2M `actAs` assumption.** (LocalNet note: this Splice LocalNet shares fixed container names with the `cn-darkpools` quickstart — only one runs at a time. Bring it up with `npm run canton:up`; its last `:3010` step fails harmlessly — verify `:2975/readyz`.)
2. **Live end-to-end run** — point the service at `:2975` with that config and run the integration scenario for real; reconcile the exact `emptyExtraArgs` JSON and whether `DarkPool_Match` needs the factory disclosed (co-hosted: expected not).
3. **Deploy to DigitalOcean** — §8.
4. **FiveNorth** — deploy both DARs there, run the same bootstrap (env-driven), confirm `actAs`.

## 8. Deploy to DigitalOcean

Same pattern as the already-deployed `wallet-service` (DO `157.245.139.105:3010`). Not yet wired — to do:
1. Add `Dockerfile` here — copy `../wallet-service/Dockerfile` (multi-stage Node 24), swap the workspace name to `@canton-dappbooster/dark-pool-service`, `EXPOSE 3020`, `CMD ["node","dist/server.js"]`.
2. Add `canton-barebones/docker-compose.dark-pool-service.yaml` — mirror `docker-compose.wallet-service.yaml`: `--env-file`, `3020:3020`, healthcheck `wget http://127.0.0.1:3020/healthz`; add root scripts `dark-pool-service:fivenorth` / `:down`.
3. Env on the host (`--env-file`): `CANTON_JSON_API_URL` (FiveNorth), `FIVENORTH_AUTH_URL/CLIENT_ID/CLIENT_SECRET/SCOPE` (reuse wallet-service's M2M creds), `DARK_POOL_SERVICE_PORT=3020`, `MATCH_INTERVAL_MS=300000`, `CORS_ORIGINS=*`, and ship `dark-pool.bootstrap.json` (mount or bake) with `DARK_POOL_BOOTSTRAP` pointing at it.
4. `docker compose -f canton-barebones/docker-compose.dark-pool-service.yaml --env-file <env> up -d --build`. Secrets via env, never committed.

## 9. Frontend integration guide

The backend is decoupled on purpose — the frontend wires to it by **swapping the data source**, not rewriting views.

1. **Develop against mock mode now** — `DARK_POOL_MOCK=1 npm --prefix canton-barebones/dark-pool-service run dev` gives a fully working API at `http://localhost:3020` with seeded data and live matching (`POST /venue/match`). No Canton needed.
2. **Implement `HttpDarkPoolClient`** to replace `MockDarkPoolClient` in `dapp/frontend/src/darkpool/DarkPoolProvider.tsx`, backed by `fetch` against a `VITE_DARK_POOL_API` base URL:
   - **Trade view (`/`)**: poll `GET /trade?party=<connectedPartyId>` every ~2–3 s; map `pools`→`listPools`, `orders`→`useMyOrders`, `fills`→`useMyFills`, `balances`→`useBalances`. `placeOrder` → `POST /orders {party,side,quantity,limitPrice,minFill,expiresAt?}`; `cancelOrder` → `DELETE /orders/:cid {party}`; faucet → `POST /faucet {party,instrument?,amount?}`.
   - **Venue view (`/venue`)**: poll `GET /venue`; render each `pools[poolId].book` + `trades` + `stats`. A "Run matching now" button → `POST /venue/match`. Use `schedule.nextRunAt` (absolute) to render a live countdown client-side; `PUT /venue/schedule {intervalMs}` to change the cadence from a form.
   - Wrap polling in `setInterval`/react-query/SWR and call the existing store's `notify()` so the current `useSyncExternalStore` hooks re-render unchanged.
3. **Type-mapping notes** (small gaps to handle in the client):
   - `Order.submittedAt` is a ledger **offset**, not ms — use it only for ordering, or synthesize a display time.
   - `Pool` from the API has `{poolId, base, quote, minFillFloor}` but may lack `baseLabel`/`quoteLabel` — derive labels from `base.id`/`quote.id` if the UI needs them.
   - All numbers are **strings** — parse for display/formatting.
   - Amounts in `expiresAt`: send ms epoch (the API converts to ISO).
4. **Darkness:** never request or render other traders' orders in the trade view — `/trade` only returns the caller's. The book is venue-only.
5. **Identity (v1):** the connected party must be a **co-hosted** party the backend can `actAs` for `POST /orders` to work (the bootstrap seeds demo traders `alice`/`bob`). Faucet + reads work for any partyId.
6. **Known blocker (frontend-side, not backend):** `localhost:3012` currently renders blank — it's the connect-wallet gate / the wallet-companion on `:3011`, not an API problem. Get the wallet running on `:3011` (or inspect the connect gate) before wiring.

---

**Deeper internal docs (local, gitignored under `docs/`):** the approved design spec, the two implementation plans, and the session handover — `docs/superpowers/specs/2026-06-13-dark-pool-backend-design.md`, `docs/superpowers/plans/2026-06-13-dark-pool-{foundation,backend-service}.md`, `docs/handover/dark-pool-backend-handover.md`.
