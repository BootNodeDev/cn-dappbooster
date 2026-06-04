import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { sortAccounts } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'

const acct = (over: Partial<AccountPublic>): AccountPublic => ({
  id: 'id',
  name: 'name',
  partyId: 'party',
  publicKeyBase64: 'pk',
  network: 'localnet',
  isPrimary: false,
  createdAt: 0,
  ...over,
})

describe('sortAccounts', () => {
  it('puts the primary account first, then orders by createdAt ascending', () => {
    const a = acct({ id: 'a', createdAt: 3, isPrimary: false })
    const b = acct({ id: 'b', createdAt: 1, isPrimary: false })
    const c = acct({ id: 'c', createdAt: 2, isPrimary: true })
    const sorted = sortAccounts([a, b, c]).map((x) => x.id)
    assert.deepEqual(sorted, ['c', 'b', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [acct({ id: 'a', createdAt: 2 }), acct({ id: 'b', createdAt: 1 })]
    const before = input.map((x) => x.id)
    sortAccounts(input)
    assert.deepEqual(
      input.map((x) => x.id),
      before,
    )
  })
})
