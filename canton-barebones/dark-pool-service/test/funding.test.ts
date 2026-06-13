import assert from 'node:assert/strict'
import { test } from 'node:test'
import { requiredFunding, selectFunding } from '../src/funding.ts'
import type { Holding } from '../src/types.ts'

const instr = { admin: 'admin', id: 'TTB' }
const hold = (contractId: string, amount: string): Holding => ({
  contractId,
  owner: 'alice',
  instrument: instr,
  amount,
})

test('requiredFunding: Buy needs floorTo10(quantity*limitPrice)', () => {
  assert.equal(requiredFunding('Buy', '10.0', '2.0'), parseFundingExpected('20.0'))
})

test('requiredFunding: Sell needs quantity', () => {
  assert.equal(requiredFunding('Sell', '10.0', '2.0'), parseFundingExpected('10.0'))
})

test('selectFunding: exact cover picks the single holding', () => {
  const cids = selectFunding([hold('h1', '20.0')], requiredFunding('Buy', '10.0', '2.0'))
  assert.deepEqual(cids, ['h1'])
})

test('selectFunding: over-cover stops once the bound is met, largest first', () => {
  const holdings = [hold('small', '5.0'), hold('big', '18.0'), hold('mid', '10.0')]
  const cids = selectFunding(holdings, requiredFunding('Buy', '10.0', '2.0'))
  assert.deepEqual(cids, ['big', 'mid'])
})

test('selectFunding: insufficient holdings return null', () => {
  const cids = selectFunding([hold('h1', '5.0')], requiredFunding('Buy', '10.0', '2.0'))
  assert.equal(cids, null)
})

// Local 10dp parse to assert exact scaled values without importing internals twice.
function parseFundingExpected(s: string): bigint {
  const [intPart, frac = ''] = s.split('.')
  return BigInt(intPart) * 10n ** 10n + BigInt((frac + '0000000000').slice(0, 10))
}
