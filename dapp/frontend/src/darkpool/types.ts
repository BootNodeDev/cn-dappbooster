export type Side = 'Buy' | 'Sell'

export interface InstrumentId {
  admin: string
  id: string
}

export interface Pool {
  poolId: string
  base: InstrumentId
  quote: InstrumentId
  baseLabel: string
  quoteLabel: string
  minFillFloor: number
}

export interface Balance {
  instrument: InstrumentId
  label: string
  total: number
  declared: number
}

export interface Order {
  orderId: string
  poolId: string
  trader: string
  side: Side
  quantity: number
  limitPrice: number
  minFill: number
  expiresAt: number | null
  submittedAt: number
}

export interface Fill {
  fillId: string
  poolId: string
  side: Side
  price: number
  quantity: number
  notional: number
  counterpartyLabel: string
  settledAt: number
}

export interface Trade {
  tradeId: string
  poolId: string
  price: number
  quantity: number
  buyer: string
  seller: string
  settledAt: number
}

export interface PlaceOrderRequest {
  poolId: string
  side: Side
  limitPrice: number
  quantity: number
  minFill: number
  expiresAt: number | null
}

export interface MatchResult {
  execPrice: number
  fillQty: number
  buyRemainder: Order | null
  sellRemainder: Order | null
}

export interface DarkPoolClient {
  listPools(): Pool[]
  getBalances(party: string): Balance[]
  placeOrder(party: string, req: PlaceOrderRequest): Promise<Order>
  cancelOrder(party: string, orderId: string): Promise<void>
  listMyOrders(party: string): Order[]
  listMyFills(party: string): Fill[]
  listBook(poolId: string): Order[]
  matchOrders(buyOrderId: string, sellOrderId: string): Promise<MatchResult>
  listTrades(poolId: string): Trade[]
  subscribe(listener: () => void): () => void
}
