import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cancelOrder, match, mint, placeOrder, rejectOrder } from '../src/commands.ts'

test('placeOrder exercises DarkPool_PlaceOrder on the pool', () => {
  const c = placeOrder({
    poolCid: 'P',
    trader: 'alice',
    side: 'Buy',
    quantity: '10.0',
    limitPrice: '2.0',
    minFill: '1.0',
    expiresAt: null,
    holdingCids: ['h1'],
  })
  assert.equal(c.ExerciseCommand.templateId, '#dark-pool:DarkPool:DarkPool')
  assert.equal(c.ExerciseCommand.contractId, 'P')
  assert.equal(c.ExerciseCommand.choice, 'DarkPool_PlaceOrder')
  assert.deepEqual(c.ExerciseCommand.choiceArgument.holdingCids, ['h1'])
  assert.equal(c.ExerciseCommand.choiceArgument.expiresAt, null)
})

test('cancelOrder exercises Order_Cancel on the order', () => {
  const c = cancelOrder('o1')
  assert.equal(c.ExerciseCommand.templateId, '#dark-pool:DarkPool:Order')
  assert.equal(c.ExerciseCommand.contractId, 'o1')
  assert.equal(c.ExerciseCommand.choice, 'Order_Cancel')
})

test('rejectOrder exercises Order_Reject on the order', () => {
  const c = rejectOrder('o2')
  assert.equal(c.ExerciseCommand.choice, 'Order_Reject')
  assert.equal(c.ExerciseCommand.contractId, 'o2')
})

test('match passes the single factoryCid for both legs', () => {
  const c = match({
    poolCid: 'P',
    buyOrderCid: 'b',
    sellOrderCid: 's',
    matchId: 'm',
    factoryCid: 'F',
    requestedAt: 't0',
    allocateBefore: 't1',
    settleBefore: 't2',
  })
  const a = c.ExerciseCommand.choiceArgument as Record<string, { allocationFactoryCid: string }>
  assert.equal(c.ExerciseCommand.choice, 'DarkPool_Match')
  assert.equal(a.buyFunding.allocationFactoryCid, 'F')
  assert.equal(a.sellFunding.allocationFactoryCid, 'F')
})

test('mint exercises RegistryRules.Mint by symbol', () => {
  const c = mint({ factoryCid: 'F', symbol: 'TTA', to: 'alice', amount: '100.0' })
  assert.equal(c.ExerciseCommand.templateId, '#registry-token:RegistryToken:RegistryRules')
  assert.equal(c.ExerciseCommand.choice, 'Mint')
  assert.deepEqual(c.ExerciseCommand.choiceArgument, {
    symbol: 'TTA',
    to: 'alice',
    amount: '100.0',
  })
})
