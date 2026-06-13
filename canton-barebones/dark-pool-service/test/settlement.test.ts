import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Ledger, TxEvent } from '../src/ledger.ts'
import type { Projection } from '../src/projection.ts'
import { settle } from '../src/settlement.ts'
import type { MatchPlan, OrderContract, Side, Trade } from '../src/types.ts'

const order = (contractId: string, trader: string, side: Side): OrderContract => ({
  contractId,
  createdOffset: 1,
  trader,
  venue: 'venue',
  poolId: 'TTA-TTB',
  base: { admin: 'admin', id: 'TTA' },
  quote: { admin: 'admin', id: 'TTB' },
  side,
  quantity: '10.0',
  limitPrice: '2.0',
  minFill: '1.0',
  expiresAt: null,
  holdingCids: [],
})

const plan: MatchPlan = { poolId: 'TTA-TTB', buyOrderCid: 'b', sellOrderCid: 's', fillQty: '10.0' }

const fakeProjection = (recorded: Trade[]): Projection => ({
  refresh: async () => {},
  pools: () => [],
  openOrders: () => [order('b', 'alice', 'Buy'), order('s', 'bob', 'Sell')],
  holdings: () => [],
  trades: () => recorded,
  recordTrade: (trade) => {
    recorded.push(trade)
  },
})

test('settle submits DarkPool_Match and records the trade from the MatchResult', async () => {
  const submitted: object[][] = []
  const ledger: Ledger = {
    ledgerEnd: async () => 0,
    activeContracts: async () => [],
    updatesFrom: async () => [],
    submit: async (_actAs, commands) => {
      submitted.push(commands)
      const events: TxEvent[] = [
        {
          ExercisedEvent: {
            choice: 'DarkPool_Match',
            contractId: 'P',
            exerciseResult: { execPrice: '1.5', fillQty: '10.0' },
          },
        },
      ]
      return events
    },
  }
  const recorded: Trade[] = []
  const outcome = await settle(plan, {
    ledger,
    projection: fakeProjection(recorded),
    venue: 'venue',
    poolCid: 'P',
    factoryCid: 'F',
    now: () => 1_000_000,
  })

  assert.equal(submitted.length, 1)
  const arg = (
    submitted[0][0] as {
      ExerciseCommand: {
        choice: string
        choiceArgument: Record<string, { allocationFactoryCid: string }>
      }
    }
  ).ExerciseCommand
  assert.equal(arg.choice, 'DarkPool_Match')
  assert.equal(arg.choiceArgument.buyFunding.allocationFactoryCid, 'F')
  assert.equal(arg.choiceArgument.sellFunding.allocationFactoryCid, 'F')

  assert.equal(outcome.rejected, null)
  assert.deepEqual(recorded, [
    {
      tradeId: outcome.settled?.tradeId,
      poolId: 'TTA-TTB',
      price: '1.5',
      quantity: '10.0',
      buyer: 'alice',
      seller: 'bob',
      settledAt: 1_000_000,
    },
  ])
})

test('settle is fail-closed: a submit error refreshes and reports the pair rejected', async () => {
  let refreshed = false
  const ledger: Ledger = {
    ledgerEnd: async () => 0,
    activeContracts: async () => [],
    updatesFrom: async () => [],
    submit: async () => {
      throw new Error('stale funding')
    },
  }
  const projection = {
    ...fakeProjection([]),
    refresh: async () => {
      refreshed = true
    },
  }
  const outcome = await settle(plan, {
    ledger,
    projection,
    venue: 'venue',
    poolCid: 'P',
    factoryCid: 'F',
    now: () => 1_000_000,
  })
  assert.equal(refreshed, true)
  assert.equal(outcome.settled, null)
  assert.equal(outcome.rejected?.reason, 'stale funding')
})
