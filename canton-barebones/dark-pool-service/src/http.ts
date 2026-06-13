// Express routers (spec §6). /venue is the operator view (sees the whole book);
// /trade?party= is a trader view (own orders only) — the dark-pool privacy model.
import cors from 'cors'
import express, { type Express, type Request, type Response } from 'express'
import { cancelOrder, mint, placeOrder } from './commands.ts'
import type { Config } from './config.ts'
import { requiredFunding, selectFunding } from './funding.ts'
import { createdCid, type Ledger } from './ledger.ts'
import { bookFor, myOrders, type Projection, toBalances } from './projection.ts'
import type { Scheduler } from './scheduler.ts'
import type {
  Balance,
  FillDto,
  Holding,
  InstrumentId,
  OrderContract,
  OrderDto,
  Side,
  Trade,
} from './types.ts'

export interface AppContext {
  config: Config
  ledger: Ledger
  projection: Projection
  scheduler: Scheduler
}

const MIN_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000
const DEFAULT_FAUCET_AMOUNT = '1000.0'

const instrumentsOf = (config: Config): InstrumentId[] => [
  config.instruments.base,
  config.instruments.quote,
]

const sameInstrument = (a: InstrumentId, b: InstrumentId): boolean =>
  a.admin === b.admin && a.id === b.id

const fundingInstrument = (config: Config, side: Side): InstrumentId =>
  side === 'Buy' ? config.instruments.quote : config.instruments.base

const orderDto = (order: OrderContract): OrderDto => ({
  cid: order.contractId,
  poolId: order.poolId,
  side: order.side,
  quantity: order.quantity,
  limitPrice: order.limitPrice,
  minFill: order.minFill,
  submittedAt: order.createdOffset,
  expiresAt: order.expiresAt,
})

const fillDto = (trade: Trade, party: string): FillDto => ({
  tradeId: trade.tradeId,
  poolId: trade.poolId,
  side: trade.buyer === party ? 'Buy' : 'Sell',
  price: trade.price,
  quantity: trade.quantity,
  settledAt: trade.settledAt,
})

const poolStats = (book: OrderContract[], trades: Trade[]) => ({
  openBuys: book.filter((order) => order.side === 'Buy').length,
  openSells: book.filter((order) => order.side === 'Sell').length,
  matchesSettled: trades.length,
  lastTrade: trades.at(-1) ?? null,
})

const holdingsOf = (projection: Projection, party: string, instrument: InstrumentId): Holding[] =>
  projection
    .holdings()
    .filter((holding) => holding.owner === party && sameInstrument(holding.instrument, instrument))

const balancesOf = (projection: Projection, config: Config, party: string): Balance[] =>
  toBalances(projection.holdings(), projection.openOrders(), party, instrumentsOf(config))

const getVenue =
  (ctx: AppContext) =>
  async (_req: Request, res: Response): Promise<void> => {
    await ctx.projection.refresh()
    const trades = ctx.projection.trades()
    const orders = ctx.projection.openOrders()
    const pools = Object.fromEntries(
      ctx.projection.pools().map((pool) => {
        const book = bookFor(orders, pool.poolId)
        const poolTrades = trades.filter((trade) => trade.poolId === pool.poolId)
        return [
          pool.poolId,
          {
            pool,
            book: book.map(orderDto),
            trades: poolTrades,
            stats: poolStats(book, poolTrades),
          },
        ]
      }),
    )
    res.json({ pools, schedule: ctx.scheduler.schedule() })
  }

const getTrade =
  (ctx: AppContext) =>
  async (req: Request, res: Response): Promise<void> => {
    const party = String(req.query.party ?? '')
    if (party === '') {
      res.status(400).json({ error: 'party query parameter is required' })
      return
    }
    await ctx.projection.refresh()
    const trades = ctx.projection
      .trades()
      .filter((trade) => trade.buyer === party || trade.seller === party)
    res.json({
      pools: ctx.projection.pools(),
      orders: myOrders(ctx.projection.openOrders(), party).map(orderDto),
      fills: trades.map((trade) => fillDto(trade, party)),
      balances: balancesOf(ctx.projection, ctx.config, party),
    })
  }

const postFaucet =
  (ctx: AppContext) =>
  async (req: Request, res: Response): Promise<void> => {
    const { party, instrument, amount } = req.body as {
      party?: string
      instrument?: string
      amount?: string
    }
    if (!party) {
      res.status(400).json({ error: 'party is required' })
      return
    }
    const symbol = instrument ?? ctx.config.instruments.base.id
    const command = mint({
      factoryCid: ctx.config.factoryCid,
      symbol,
      to: party,
      amount: amount ?? DEFAULT_FAUCET_AMOUNT,
    })
    await ctx.ledger.submit(ctx.config.parties.admin, [command])
    await ctx.projection.refresh()
    res.json({ balances: balancesOf(ctx.projection, ctx.config, party) })
  }

interface PlaceBody {
  party?: string
  poolId?: string
  side?: Side
  quantity?: string
  limitPrice?: string
  minFill?: string
  expiresAt?: number | null
}

const postOrders =
  (ctx: AppContext) =>
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as PlaceBody
    if (!body.party || !body.side || !body.quantity || !body.limitPrice || !body.minFill) {
      res.status(400).json({ error: 'party, side, quantity, limitPrice, minFill are required' })
      return
    }
    if (body.poolId !== undefined && body.poolId !== ctx.config.poolId) {
      res.status(404).json({ error: `unknown pool ${body.poolId}` })
      return
    }
    await ctx.projection.refresh()
    const required = requiredFunding(body.side, body.quantity, body.limitPrice)
    const holdings = holdingsOf(
      ctx.projection,
      body.party,
      fundingInstrument(ctx.config, body.side),
    )
    const holdingCids = selectFunding(holdings, required)
    if (holdingCids === null) {
      res.status(400).json({ error: 'insufficient funding holdings to cover the order' })
      return
    }
    const command = placeOrder({
      poolCid: ctx.config.poolCid,
      trader: body.party,
      side: body.side,
      quantity: body.quantity,
      limitPrice: body.limitPrice,
      minFill: body.minFill,
      expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
      holdingCids,
    })
    const events = await ctx.ledger.submit(body.party, [command])
    const cid = createdCid(events, ':DarkPool:Order')
    await ctx.projection.refresh()
    const created = ctx.projection.openOrders().find((order) => order.contractId === cid)
    res.status(201).json({ order: created ? orderDto(created) : { cid } })
  }

const deleteOrder =
  (ctx: AppContext) =>
  async (req: Request, res: Response): Promise<void> => {
    const party = (req.body as { party?: string }).party
    if (!party) {
      res.status(400).json({ error: 'party is required' })
      return
    }
    const cid = String(req.params.cid)
    await ctx.ledger.submit(party, [cancelOrder(cid)])
    await ctx.projection.refresh()
    res.json({ cancelled: cid })
  }

const postMatch =
  (ctx: AppContext) =>
  async (_req: Request, res: Response): Promise<void> => {
    const report = await ctx.scheduler.runPass()
    res.json({ ...report, schedule: ctx.scheduler.schedule() })
  }

const putSchedule =
  (ctx: AppContext) =>
  (req: Request, res: Response): void => {
    const intervalMs = Number((req.body as { intervalMs?: number }).intervalMs)
    if (
      !Number.isInteger(intervalMs) ||
      intervalMs < MIN_INTERVAL_MS ||
      intervalMs > MAX_INTERVAL_MS
    ) {
      res.status(400).json({
        error: `intervalMs must be an integer in [${MIN_INTERVAL_MS}, ${MAX_INTERVAL_MS}]`,
      })
      return
    }
    res.json(ctx.scheduler.setIntervalMs(intervalMs))
  }

export const createApp = (ctx: AppContext): Express => {
  const app = express()
  app.use(cors({ origin: ctx.config.corsOrigins }))
  app.use(express.json())

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }))
  app.get('/readyz', (_req, res) => res.json({ status: 'ready' }))
  app.get('/venue', getVenue(ctx))
  app.get('/trade', getTrade(ctx))
  app.post('/faucet', postFaucet(ctx))
  app.post('/orders', postOrders(ctx))
  app.delete('/orders/:cid', deleteOrder(ctx))
  app.post('/venue/match', postMatch(ctx))
  app.put('/venue/schedule', putSchedule(ctx))

  app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: message })
  })
  return app
}
