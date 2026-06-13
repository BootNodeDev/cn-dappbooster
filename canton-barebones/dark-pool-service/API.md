# Dark Pool Service — Engineering Guide & API Reference

For engineering: the design and **the concessions behind it**, **what the matcher does (and doesn't)**, **how the matching cron works** (and how to force it / change its interval), and **how to use every endpoint — with full request/response JSON**. Examples use the mock fixture ids, so they're real against `DARK_POOL_MOCK=1 npm run dev` (`http://localhost:3020`).

---

## 1. What it is

A **dark pool**: limit orders are private — only the trader and the venue see them. The venue periodically inspects the hidden book, finds buy/sell pairs whose prices cross, and settles them at a fair midpoint, atomically, on a Canton ledger.

The on-ledger contracts enforce the rules and move the assets. This **off-ledger service is the driver**: it funds traders, places/cancels orders, watches the book, decides which pairs to match, submits settlement, and serves the read APIs. Two consumers: a **trader view** (own orders + balances) and a **venue/operator view** (the whole book + settled trades + matching controls).

---

## 2. Concessions & tradeoffs (what v1 deliberately does NOT do)

Read these first — they answer most "why is it like this?" questions.

1. **Custodial / co-hosted.** One process holds one ledger token and acts *as* the venue, the token admin, **and every trader**. → the operator is trusted with custody (it can move trader funds); no per-trader keys. Fine for a single-operator demo; **not** trust-minimized.
2. **No authentication (yet).** Callers pass a `partyId` in plaintext — no session/SIWE/signature. Anyone reaching the API can act as any co-hosted party. → **don't expose publicly as-is.** Auth deferred.
3. **Only co-hosted parties can place orders.** `POST /orders` acts *as* the party, so it only works for the parties the backend holds (the seeded demo traders). External wallet parties can faucet + read but **can't place** — wallet-signed placement is future work.
4. **Single process, single pool.** Matcher runs in-process (not a separate daemon, not HA). One pair in v1.
5. **No database — in-memory projection.** Live state is polled from the ledger (the **ledger is the source of truth**). Settled **trades are kept in memory and start empty after a restart** (they still exist on-ledger; re-deriving the history isn't implemented). Live state is always correct; only the *trade-history view* is volatile.
6. **The matcher is greedy, not optimal.** Best-priced/oldest first, one pair per buy per pass. Larger orders re-rest and match over later passes. Deterministic; converges over passes.
7. **Price is the floored midpoint**, computed **on-ledger** (`floor10((buy+sell)/2)`). No price-improvement/pro-rata. Amounts round **down** (the payer is shaved, never padded).
8. **Fail-closed, no retry.** If a trader moved declared funding, the match fails; the service **rejects that order** and moves on (trader re-places). Never blind-retries. Safety over liveness.
9. **The matcher never splits orders** — partial fills/remainders are created **on-ledger**; the matcher only picks the pair + fill quantity (`min` of the two sizes).
10. **Custom token, not CIP-56** — CIP-56 can't be settled by the dark pool (transfer-instruction standard, not the allocation standard the contract uses). We trade a registry token we control.
11. **Matching is periodic, not on-placement.** Placing doesn't match — the order rests until the next pass (or a manual trigger). Heartbeat defaults to **5 min** (demo: stage, narrate, trigger). Lower it in prod.
12. **Mock mode exists** — the whole service runs against an in-memory fake ledger; most testing so far is against it, so the live-ledger path is the least-exercised part.

---

## 3. What the matcher does (and doesn't) — `src/matcher.ts`

Pure function `findMatches(pool, orders, now) → MatchPlan[]`. No I/O, deterministic.

**Does, per pool:** (1) drop out-of-pool + expired orders; (2) sort buys by price **desc**, sells by price **asc**, ties by **oldest createdOffset** (price-time priority); (3) for each buy, take the **first** sell that's unused this pass, a **different trader**, and **crossing** (`buyLimit ≥ sellLimit`); (4) keep it only if `min(buyQty, sellQty)` ≥ **both** `minFill`s and both `minFill` ≥ the pool's `minFillFloor`; (5) emit `MatchPlan { buyOrderCid, sellOrderCid, fillQty }`, **one sell per buy per pass**.

Guarantee: every plan already satisfies **all** the contract's preconditions, so a settlement failure means a real race (funding moved / cancelled), never a matcher bug.

**Doesn't:** set the price (the contract derives the floored midpoint); split orders / make remainders (contract does, on-ledger); retry, optimize globally, or cross pools; use any clock but the `now` it's given.

---

## 4. How the matching cron works — `src/scheduler.ts`

One function, `runPass()`, is the venue's **single writer** (a guard makes overlapping passes return `{ skipped: true }`). Each pass: (1) **refresh** the projection; (2) **match** (run the matcher → plans); (3) **settle** each plan **sequentially** via `DarkPool_Match` (record a trade on success; fail-closed on a stale-funding race); (4) **sweep** expired orders (`Order_Reject`). Returns `{ ranAt, matched, rejected }`.

**What runs it:**
- **Heartbeat** — a self-rescheduling timer; after every pass (timed or manual) it re-arms to `now + intervalMs`. Default `MATCH_INTERVAL_MS = 300000` (5 min).
- **Manual trigger** — `POST /venue/match`.

**Force a pass now:** `POST /venue/match` (§6) — runs `runPass()` immediately and re-arms the timer. This is the operator's "Run matching now" button.

**Change the interval N:** `PUT /venue/schedule { intervalMs }` (§6), 1 s – 24 h. Re-arms immediately; **not persisted** (reverts to `MATCH_INTERVAL_MS` on restart).

`nextRunAt` (absolute epoch ms) is returned by `GET /venue`, `POST /venue/match`, and `PUT /venue/schedule` so a UI can render a live countdown.

---

## 5. Data structures

Decimals are **strings** (the ledger may return them 10-dp-normalized like `"10.0000000000"`; you can send `"10.0"`). Times are epoch **ms**, except `Order.submittedAt`, which is a **ledger offset** — an ordering key, not a clock value.

```jsonc
InstrumentId { "admin": "darkpool-admin::mock", "id": "TTA" }

Pool {
  "poolId": "TTA-TTB",
  "base":  { "admin": "darkpool-admin::mock", "id": "TTA" },
  "quote": { "admin": "darkpool-admin::mock", "id": "TTB" },
  "minFillFloor": "1.0"          // no labels — derive from base.id / quote.id
}

Order (DTO) {
  "cid": "00a1b2c3", "poolId": "TTA-TTB", "side": "Buy",   // "Buy" | "Sell"
  "quantity": "10.0", "limitPrice": "2.0", "minFill": "1.0",
  "submittedAt": 42,             // ledger OFFSET (ordering key), not ms
  "expiresAt": null              // ms epoch, or null
}

Trade {                          // venue record — in /venue
  "tradeId": "TTA-TTB:8f2a3c", "poolId": "TTA-TTB",
  "price": "1.5000000000", "quantity": "8.0000000000",
  "buyer": "darkpool-alice::mock", "seller": "darkpool-bob::mock",
  "settledAt": 1750000000000
}

Fill (DTO) {                     // your own side — in /trade
  "tradeId": "TTA-TTB:8f2a3c", "poolId": "TTA-TTB", "side": "Buy",
  "price": "1.5000000000", "quantity": "8.0000000000", "settledAt": 1750000000000
}

Balance {
  "instrument": { "admin": "darkpool-admin::mock", "id": "TTA" },
  "total": "10000.0000000000",   // what the party holds
  "declared": "0.0000000000"     // slice locked by the party's open orders
}

Schedule { "intervalMs": 300000, "nextRunAt": 1750000300000 }   // nextRunAt: ms or null
```

---

## 6. Endpoints — how to use each (full request/response)

Base `http://localhost:3020`, JSON, no auth (v1). Errors: non-2xx → `{ "error": "<message>" }`.

### `GET /venue` — operator view (poll on the venue page)
The whole book + trades + stats + the schedule, per pool. `pools` is an **object keyed by poolId**.
```bash
curl http://localhost:3020/venue
```
```json
{
  "pools": {
    "TTA-TTB": {
      "pool": {
        "poolId": "TTA-TTB",
        "base":  { "admin": "darkpool-admin::mock", "id": "TTA" },
        "quote": { "admin": "darkpool-admin::mock", "id": "TTB" },
        "minFillFloor": "1.0"
      },
      "book": [
        { "cid": "00a1b2c3", "poolId": "TTA-TTB", "side": "Buy",  "quantity": "10.0", "limitPrice": "2.0", "minFill": "1.0", "submittedAt": 42, "expiresAt": null },
        { "cid": "00d4e5f6", "poolId": "TTA-TTB", "side": "Sell", "quantity": "8.0",  "limitPrice": "1.0", "minFill": "1.0", "submittedAt": 47, "expiresAt": 1765432100000 }
      ],
      "trades": [
        { "tradeId": "TTA-TTB:8f2a3c", "poolId": "TTA-TTB", "price": "1.5000000000", "quantity": "5.0000000000", "buyer": "darkpool-alice::mock", "seller": "darkpool-bob::mock", "settledAt": 1750000000000 }
      ],
      "stats": {
        "openBuys": 1, "openSells": 1, "matchesSettled": 1,
        "lastTrade": { "tradeId": "TTA-TTB:8f2a3c", "poolId": "TTA-TTB", "price": "1.5000000000", "quantity": "5.0000000000", "buyer": "darkpool-alice::mock", "seller": "darkpool-bob::mock", "settledAt": 1750000000000 }
      }
    }
  },
  "schedule": { "intervalMs": 300000, "nextRunAt": 1750000300000 }
}
```
`lastTrade` is `null` if none yet.

### `GET /trade?party=<partyId>` — trader view (poll on the trade page)
The public pool list + the caller's **own** orders/fills/balances. **Never** other traders' orders. `pools` here is an **array** (different shape from `/venue`).
```bash
curl "http://localhost:3020/trade?party=darkpool-alice::mock"
```
```json
{
  "pools": [
    { "poolId": "TTA-TTB", "base": { "admin": "darkpool-admin::mock", "id": "TTA" }, "quote": { "admin": "darkpool-admin::mock", "id": "TTB" }, "minFillFloor": "1.0" }
  ],
  "orders": [
    { "cid": "00a1b2c3", "poolId": "TTA-TTB", "side": "Buy", "quantity": "10.0", "limitPrice": "2.0", "minFill": "1.0", "submittedAt": 42, "expiresAt": null }
  ],
  "fills": [
    { "tradeId": "TTA-TTB:8f2a3c", "poolId": "TTA-TTB", "side": "Buy", "price": "1.5000000000", "quantity": "5.0000000000", "settledAt": 1750000000000 }
  ],
  "balances": [
    { "instrument": { "admin": "darkpool-admin::mock", "id": "TTA" }, "total": "10005.0000000000", "declared": "0.0000000000" },
    { "instrument": { "admin": "darkpool-admin::mock", "id": "TTB" }, "total": "9990.0000000000", "declared": "10.0000000000" }
  ]
}
```
`400` if `party` is missing.

### `POST /orders` — place an order
`party`, `side` (`Buy`/`Sell`), `quantity`, `limitPrice`, `minFill` required; `poolId` optional (defaults to the one pool); `expiresAt` optional (ms epoch or null). The service auto-selects the party's funding holdings, then places as that party. Placing does **not** match.
```bash
curl -X POST http://localhost:3020/orders -H 'Content-Type: application/json' -d '{
  "party": "darkpool-alice::mock",
  "side": "Buy",
  "quantity": "10.0",
  "limitPrice": "2.0",
  "minFill": "1.0",
  "expiresAt": null
}'
```
```json
{ "order": { "cid": "00a1b2c3", "poolId": "TTA-TTB", "side": "Buy", "quantity": "10.0", "limitPrice": "2.0", "minFill": "1.0", "submittedAt": 51, "expiresAt": null } }
```
`201` on success. `400` missing fields or `"insufficient funding holdings to cover the order"`; `404` unknown pool. Needs a co-hosted party.

### `DELETE /orders/:cid` — cancel an order
```bash
curl -X DELETE http://localhost:3020/orders/00a1b2c3 -H 'Content-Type: application/json' -d '{ "party": "darkpool-alice::mock" }'
```
```json
{ "cancelled": "00a1b2c3" }
```
`400` if `party` missing.

### `POST /faucet` — mint test tokens (any party)
`party` required; `instrument` optional (token **symbol**, defaults to base); `amount` optional (default `"1000.0"`). Returns balances after minting.
```bash
curl -X POST http://localhost:3020/faucet -H 'Content-Type: application/json' -d '{
  "party": "darkpool-alice::mock", "instrument": "TTA", "amount": "1000.0"
}'
```
```json
{ "balances": [
  { "instrument": { "admin": "darkpool-admin::mock", "id": "TTA" }, "total": "11000.0000000000", "declared": "0.0000000000" },
  { "instrument": { "admin": "darkpool-admin::mock", "id": "TTB" }, "total": "10000.0000000000", "declared": "0.0000000000" }
] }
```

### `POST /venue/match` — **force a matching pass now**
No body. Runs `runPass()` immediately, re-arms the heartbeat.
```bash
curl -X POST http://localhost:3020/venue/match
```
```json
{
  "ranAt": 1750000000000,
  "matched": [ { "poolId": "TTA-TTB", "buyer": "darkpool-alice::mock", "seller": "darkpool-bob::mock", "price": "1.5000000000", "qty": "8.0000000000" } ],
  "rejected": [ { "cid": "00c3d4e5", "reason": "expired" } ],
  "schedule": { "intervalMs": 300000, "nextRunAt": 1750000300000 }
}
```
`matched: []` if nothing crosses; `"skipped": true` if a pass was already running.

### `PUT /venue/schedule` — **change the interval N**
`{ intervalMs }`, 1 s – 24 h. Re-arms immediately. Not persisted.
```bash
curl -X PUT http://localhost:3020/venue/schedule -H 'Content-Type: application/json' -d '{ "intervalMs": 60000 }'
```
```json
{ "intervalMs": 60000, "nextRunAt": 1750000060000 }
```
`400` if not an integer in range.

### `GET /healthz` · `GET /readyz`
```json
{ "status": "ok" }      // /readyz → { "status": "ready" }
```

---

## 7. Wiring the frontend

The frontend hides its data behind a `DarkPoolClient` interface with a `MockDarkPoolClient` (`dapp/frontend/src/darkpool/`). Wiring = write an `HttpDarkPoolClient` and swap it in `DarkPoolProvider.tsx`; the responses above already match the client's types. Point it at `VITE_DARK_POOL_API` (default `:3020`); develop against mock mode.

| Client need | Endpoint |
| --- | --- |
| pools / venue book / trades / stats | `GET /venue` (object keyed by poolId) |
| my orders / fills / balances / pool list | `GET /trade?party=` (`pools` is an array) |
| place / cancel | `POST /orders` / `DELETE /orders/:cid` |
| faucet | `POST /faucet` |
| run matching (operator button) | `POST /venue/match` |
| countdown | `schedule.nextRunAt` from `GET /venue`, ticked client-side |

```ts
const API = import.meta.env.VITE_DARK_POOL_API ?? 'http://localhost:3020'

const getTrade = (party: string) =>
  fetch(`${API}/trade?party=${encodeURIComponent(party)}`).then((r) => r.json())

const placeOrder = (party: string, req: { side: 'Buy'|'Sell'; quantity: string; limitPrice: string; minFill: string; expiresAt?: number|null }) =>
  fetch(`${API}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ party, ...req }) })
    .then((r) => r.json()).then((j) => j.order)

const cancelOrder = (party: string, cid: string) =>
  fetch(`${API}/orders/${encodeURIComponent(cid)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ party }) })

const runMatching = () => fetch(`${API}/venue/match`, { method: 'POST' }).then((r) => r.json())

// Trade view:  setInterval(() => getTrade(party).then(updateStore).then(notify), 2500)
// Venue view:  setInterval(() => fetch(`${API}/venue`).then(r=>r.json()).then(updateStore).then(notify), 2500)
```

---

## 8. Gotchas

- `pools` is an **object** in `/venue`, an **array** in `/trade`.
- Decimals are **strings**; `Order.submittedAt` is a **ledger offset**, not ms.
- `Pool` has **no labels** — derive from `base.id`/`quote.id`.
- **Darkness:** `/trade` returns only the caller's orders; the book is `/venue`-only.
- **Identity:** `/orders` + `DELETE` need a co-hosted (seeded) party; `/faucet` + reads take any partyId.
- **Placement ≠ match:** order rests until a pass; `POST /venue/match` to settle now.
- `localhost:3012` blank = frontend connect-wallet gate / wallet-companion on `:3011`, not this API.

---

## 9. Running

```bash
# Mock (offline, seeded, live matching) — for frontend dev:
DARK_POOL_MOCK=1 npm --prefix canton-barebones/dark-pool-service run dev   # → :3020
# Tests (33/33):
npm --prefix canton-barebones/dark-pool-service test
```
Live-ledger config and DigitalOcean deploy: see `README.md`. Mock fixture ids: `src/mock-bootstrap.json`.
