# cn-darkpools

A dark pool for trading on the Canton Network. You place an order, it stays
private until the venue finds the other side, and the two of you settle at the
price in the middle. There is no public order book for the room to read and
nothing for bots to race ahead of.

The privacy isn't a feature bolted on top. Canton only shows each party the
contracts it is a party to, so a trader sees their own orders and fills, the
venue sees the book it needs to run matching, and everyone else sees nothing.

## Status: the trading is mocked

The wallet connection (Carpincho) is real. Everything else: the order book,
balances, matching, the price chart, is simulated in the browser so you can
click around the whole app before the backend is wired up. A small engine seeds
a few counterparties and runs the matcher on a timer, so the book and fills move
on their own.

All of that data flows through one `DarkPoolClient` interface
(`src/darkpool/`). Today a `MockDarkPoolClient` backs it; swapping in a real
ledger-backed client later is a one-file change and the UI doesn't notice.

The model and the operations mirror the
[cn-dark-pool-contracts](https://github.com/BootNodeDev/cn-dark-pool-contracts)
Daml package: limit orders with a minimum fill and optional expiry, midpoint
pricing, atomic settlement, and self-funded remainders that re-rest.

## Running it

You'll need Node 20+, the repo's dependencies installed (`npm install` from the
repo root, which links every workspace), and the
[Carpincho](https://github.com/BootNodeDev/carpincho) browser extension.

```bash
# from the repo root
npm install

# start the frontend
npm run app:dev          # or: npm --workspace dapp/frontend run dev
```

The app comes up on http://localhost:3012. Click **Connect Carpincho**, approve
the request in the extension, and you're in. No environment variables are
required; the Canton network and wallet-companion URL default sensibly and can
be changed in-app (they persist to localStorage).

If you want the full local stack (validator, wallet service) rather than just
the frontend, see the scripts in `scripts/dev-stack.sh` at the repo root.

## The two views

- **`/`** is the trader's view. Pick a pair, check your balances, place a private
  order (side, limit price, quantity, minimum fill, optional expiry), and watch
  your open orders and fills. The "shielded book" panel is intentionally blurred:
  there is no public depth to show.
- **`/venue`** is the operator's view. The full resting book, plus a panel to
  pick a crossing buy and sell and settle them at the midpoint. It isn't linked
  from the nav on purpose; reach it by typing the URL. On the real ledger only
  the venue's own wallet can see this data.

## Working on it

```bash
npm --workspace dapp/frontend run dev      # dev server
npm --workspace dapp/frontend run build    # type-check + production build
npm --workspace dapp/frontend run test     # unit tests (node:test)
npm --workspace dapp/frontend run lint     # biome
```

The pricing and matching logic lives in `src/darkpool/darkpoolMath.ts` and is
covered by tests; the mock client in `src/darkpool/client/` is tested too. UI
components live under `src/features/trade` and `src/features/venue`, with shared
primitives in `src/components`.
