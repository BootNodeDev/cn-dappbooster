# Dark Pool Service (`@canton-dappbooster/dark-pool-service`)

Off-ledger backend for the CN Dark Pool: a single Express 5 + TypeScript process that serves the trader/venue REST API, runs a pure matching engine on a schedule, and settles crossing orders on a Canton ledger via the JSON Ledger API v2.

**Status (2026-06-13):** Implemented and **green — 33/33 tests** (units + a mock place→match→settle integration), typecheck clean. **Runs fully offline in mock mode.** Live-ledger end-to-end, containerization, and DO deploy are the remaining steps (§8). Branch `dark-pool-service` (off `darkpool`) — backend only; the Daml/contracts are a separate concern (§7).

## 1. Assumptions (what this service expects)

- **A Canton ledger over JSON Ledger API v2** where the dark-pool venue contracts and a funding/faucet token are already **deployed**, with a pool + parties + seed holdings **provisioned**. That setup is provided separately (contracts side) — **not in this branch**. The service reads the addresses (parties, pool, factory, instruments) from a `dark-pool.bootstrap.json` it's pointed at.
- **Custodial, co-hosted:** one bearer token can `actAs` the venue, the token-admin, and the trader parties. `POST /orders` therefore works only for **co-hosted** parties; reads and `/faucet` work for any partyId.
- **The ledger is the source of truth** — no database; an in-memory projection (polled ACS) backs reads and is rebuilt on boot.
- **Decimals are strings**, computed as scaled BigInt to mirror the on-ledger rounding exactly.
- **Mock mode assumes none of the above** — it's self-contained (`DARK_POOL_MOCK=1`).

## 2. What it is / why

Single process (the matcher is an in-process scheduled pass, not a daemon). The matcher is a **pure function whose postconditions equal the contract's preconditions** (`findMatches(pool, orders, now) → MatchPlan[]`): it only emits pairs that already satisfy every on-ledger guard, so a settlement failure means a genuine race, not a logic bug. One guarded `runPass()` is the single match writer (5-min heartbeat + manual `POST /venue/match`).

## 3. Where (module map)

`src/`: `config` (resolves config + auth source), `auth` (static/M2M/mock bearer token), `ledger` (JSON Ledger API v2 client), `decimal` (exact 10-dp), `matcher` (pure price-time), `funding` (holding selection), `projection` (ACS → caches + reducers), `settlement` (`DarkPool_Match` + fail-closed), `scheduler` (guarded pass + heartbeat), `commands` (pure builders), `http` (routes), `server`/`wiring`, `types`; plus `mockLedger` + `mock-bootstrap.json` for offline runs. `test/` mirrors the critical modules + a mock integration test. (The contracts themselves are external — addressed by package name over the API.)

## 4. How to run

**Mock — offline, zero setup (use this to develop the frontend):**
```bash
DARK_POOL_MOCK=1 npm --prefix canton-barebones/dark-pool-service run dev
# → http://localhost:3020, seeded data, live matching, no ledger/token needed
```
**Against a live ledger:** point it at the bootstrap config + a token:
```bash
CANTON_JSON_API_URL=<json-api> DARK_POOL_BOOTSTRAP=<path/to/dark-pool.bootstrap.json> \
CANTON_BACKEND_TOKEN=<token>   # or FIVENORTH_CLIENT_SECRET=… for M2M
npm --prefix canton-barebones/dark-pool-service run dev
```
Auth precedence: `DARK_POOL_MOCK=1` → mock; else `CANTON_BACKEND_TOKEN` → static; else `FIVENORTH_CLIENT_SECRET` → M2M.

## 5. How to test

```bash
npm --prefix canton-barebones/dark-pool-service test     # 33/33, no network
```
Covers decimal exactness, matcher (cross/min-fill/price-time/expiry/self-match), funding selection, projection reducers, settlement (+ fail-closed), and an end-to-end mock place→match→settle→cancel→expiry. Lint: `npm --prefix canton-barebones/dark-pool-service run lint` (Biome).

## 6. API & frontend integration

Port `3020`. JSON shaped to the frontend's existing `DarkPoolClient` types, so wiring is a swap, not a rewrite.

| Method · path | Body / query | Returns |
| --- | --- | --- |
| `GET /healthz` `/readyz` | — | health |
| `GET /venue` | — | `{ pools: {[poolId]:{pool,book,trades,stats}}, schedule:{intervalMs,nextRunAt} }` — operator view, **full book** |
| `GET /trade?party=` | `party` | `{ pools, orders, fills, balances }` — **own orders only** |
| `POST /faucet` | `{party,instrument?,amount?}` | `{ balances }` |
| `POST /orders` | `{party,side,quantity,limitPrice,minFill,poolId?,expiresAt?}` | `201 {order}` |
| `DELETE /orders/:cid` | `{party}` | `{cancelled}` |
| `POST /venue/match` | — | `{ranAt,matched,rejected,schedule}` — run a pass now |
| `PUT /venue/schedule` | `{intervalMs}` | `{intervalMs,nextRunAt}` (bounds 1s–24h) |

DTOs: `Order={cid,poolId,side,quantity,limitPrice,minFill,submittedAt,expiresAt}`, `Fill={tradeId,poolId,side,price,quantity,settledAt}`, `Trade={tradeId,poolId,price,quantity,buyer,seller,settledAt}`, `Balance={instrument,total,declared}`. All amounts are **strings**.

**To plug the frontend in:**
1. Develop against **mock mode** (§4) — full API, no backend deps.
2. Implement `HttpDarkPoolClient` replacing `MockDarkPoolClient` in `dapp/frontend/src/darkpool/DarkPoolProvider.tsx`: poll `GET /venue` (venue view) and `GET /trade?party=<connectedParty>` (trade view) every ~2–3 s and call the store's `notify()`; `placeOrder`→`POST /orders`, `cancelOrder`→`DELETE /orders/:cid`, faucet→`POST /faucet`. Base URL via `VITE_DARK_POOL_API`.
3. Countdown is free: render `schedule.nextRunAt` (absolute) client-side; "Run matching now" → `POST /venue/match`; change cadence → `PUT /venue/schedule`.
4. Darkness: never render other traders' orders in the trade view — `/trade` returns only the caller's; the book is venue-only.
5. Type gaps: `submittedAt` is a ledger ordering key (not ms); numbers are strings; `Pool` may lack `baseLabel`/`quoteLabel` (derive from `base.id`/`quote.id`).
6. Identity: `POST /orders` needs a co-hosted (seeded) party; reads/faucet take any partyId.
7. Known blocker (frontend-side, not the API): `localhost:3012` renders blank — connect-wallet gate / wallet-companion on `:3011`.

## 7. Contracts (external — not this branch)

The dark-pool contracts and the funding/faucet token live and deploy outside this branch (contracts side). The service depends only on their **deployed** package names + the `dark-pool.bootstrap.json` config. A ledger-provisioning script (`canton-barebones/scripts/dark-pool-bootstrap.mjs`) is included for whoever stands the ledger up — it allocates parties, creates the pool + factory, mints seed holdings, and emits that config. (Note: the dark pool settles a token that implements the Splice `AllocationFactory` standard; CIP-56 does not, so a compatible token must be the one deployed.)

## 8. Deploy to DigitalOcean

Same pattern as the deployed `wallet-service` (`157.245.139.105:3010`). Remaining:
1. `Dockerfile` — copy `../wallet-service/Dockerfile` (multi-stage Node 24), swap the workspace name, `EXPOSE 3020`, `CMD ["node","dist/server.js"]`.
2. `canton-barebones/docker-compose.dark-pool-service.yaml` — mirror `docker-compose.wallet-service.yaml` (`--env-file`, `3020:3020`, healthcheck `GET /healthz`); add root scripts `dark-pool-service:fivenorth` / `:down`.
3. Env: `CANTON_JSON_API_URL`, M2M creds (reuse wallet-service's `FIVENORTH_*`), `DARK_POOL_SERVICE_PORT=3020`, `MATCH_INTERVAL_MS=300000`, `CORS_ORIGINS=*`, `DARK_POOL_BOOTSTRAP=<path to mounted config>`.
4. `docker compose -f canton-barebones/docker-compose.dark-pool-service.yaml --env-file <env> up -d --build`. Secrets via env, never committed.

## 9. Done / missing / continue

**Done:** the full service + 33/33 tests + mock-mode end-to-end. **Missing:** (1) live-ledger end-to-end run (confirm `emptyExtraArgs` + disclosures at first run); (2) Dockerfile + compose (§8); (3) deploy to FiveNorth/DO. **Continue:** point the service at a provisioned ledger (§4), run the integration scenario live, then containerize + deploy.
