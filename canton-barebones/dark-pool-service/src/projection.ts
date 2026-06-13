// Projects the ACS into in-memory caches and exposes pure reducers over them.
// The ledger stays the source of truth; trades are recorded live by settlement
// and start empty on boot (the ledger still holds them — display-only).
import type { BootstrapConfig } from './config.ts'
import { parseDec, toDec } from './decimal.ts'
import type { ActiveContract, Ledger } from './ledger.ts'
import type { Balance, Holding, InstrumentId, OrderContract, Pool, Side, Trade } from './types.ts'

const POOL_TID = '#dark-pool:DarkPool:DarkPool'
const ORDER_TID = '#dark-pool:DarkPool:Order'
const HOLDING_TID = '#registry-token:RegistryToken:RegistryHolding'

const instrumentKey = (instrument: InstrumentId): string => `${instrument.admin}:${instrument.id}`

const sumAmounts = (holdings: Holding[]): string =>
  toDec(holdings.reduce((sum, holding) => sum + parseDec(holding.amount), BigInt(0)))

// total = the party's holdings of an instrument; declared = the slice locked by
// that party's open orders (sum of their orders' referenced holding amounts).
export const toBalances = (
  holdings: Holding[],
  openOrders: OrderContract[],
  party: string,
  instruments: InstrumentId[],
): Balance[] => {
  const owned = holdings.filter((holding) => holding.owner === party)
  const byCid = new Map(holdings.map((holding) => [holding.contractId, holding]))
  const declaredCids = openOrders
    .filter((order) => order.trader === party)
    .flatMap((order) => order.holdingCids)
  const declared = declaredCids
    .map((cid) => byCid.get(cid))
    .filter((holding): holding is Holding => holding !== undefined)
  return instruments.map((instrument) => {
    const key = instrumentKey(instrument)
    const matches = (holding: Holding): boolean => instrumentKey(holding.instrument) === key
    return {
      instrument,
      total: sumAmounts(owned.filter(matches)),
      declared: sumAmounts(declared.filter(matches)),
    }
  })
}

// The venue book: every resting order in a pool. Only /venue exposes this.
export const bookFor = (orders: OrderContract[], poolId: string): OrderContract[] =>
  orders.filter((order) => order.poolId === poolId)

export const myOrders = (orders: OrderContract[], party: string): OrderContract[] =>
  orders.filter((order) => order.trader === party)

const toMillis = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return value
  }
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

const parsePool = (contract: ActiveContract): Pool => {
  const args = contract.createArgument
  return {
    poolId: String(args.poolId),
    base: args.base as InstrumentId,
    quote: args.quote as InstrumentId,
    minFillFloor: String(args.minFillFloor),
  }
}

const parseOrder = (contract: ActiveContract): OrderContract => {
  const args = contract.createArgument
  return {
    contractId: contract.contractId,
    createdOffset: contract.createdOffset,
    trader: String(args.trader),
    venue: String(args.venue),
    poolId: String(args.poolId),
    base: args.base as InstrumentId,
    quote: args.quote as InstrumentId,
    side: args.side as Side,
    quantity: String(args.quantity),
    limitPrice: String(args.limitPrice),
    minFill: String(args.minFill),
    expiresAt: toMillis(args.expiresAt),
    holdingCids: (args.holdingCids as string[] | undefined) ?? [],
  }
}

const parseHolding = (contract: ActiveContract): Holding => {
  const args = contract.createArgument
  return {
    contractId: contract.contractId,
    owner: String(args.owner),
    instrument: { admin: String(args.admin), id: String(args.symbol) },
    amount: String(args.amount),
  }
}

export interface Projection {
  refresh: () => Promise<void>
  pools: () => Pool[]
  openOrders: () => OrderContract[]
  holdings: () => Holding[]
  trades: () => Trade[]
  recordTrade: (trade: Trade) => void
}

export const createProjection = (ledger: Ledger, config: BootstrapConfig): Projection => {
  const state: { pools: Pool[]; orders: OrderContract[]; holdings: Holding[]; trades: Trade[] } = {
    pools: [],
    orders: [],
    holdings: [],
    trades: [],
  }
  return {
    refresh: async () => {
      const [pools, orders, holdings] = await Promise.all([
        ledger.activeContracts(config.parties.venue, POOL_TID),
        ledger.activeContracts(config.parties.venue, ORDER_TID),
        ledger.activeContracts(config.parties.admin, HOLDING_TID),
      ])
      state.pools = pools.map(parsePool)
      state.orders = orders.map(parseOrder)
      state.holdings = holdings.map(parseHolding)
    },
    pools: () => state.pools,
    openOrders: () => state.orders,
    holdings: () => state.holdings,
    trades: () => state.trades,
    recordTrade: (trade) => {
      state.trades.push(trade)
    },
  }
}
