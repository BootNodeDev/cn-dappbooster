import { describe, expect, it } from 'vitest'
import { toExecuteParams } from './submit'
import type { DisclosedContract, LedgerCommand } from './Wallet'

const command: LedgerCommand = {
  ExerciseCommand: {
    templateId: 'pkg:Module:Entity',
    contractId: 'cid-1',
    choice: 'DoThing',
    choiceArgument: { amount: 1 },
  },
}

describe('toExecuteParams', () => {
  it('submits as the acting party with the command, no disclosures', () => {
    const params = toExecuteParams('alice::abc', command)
    expect(params.actAs).toEqual(['alice::abc'])
    expect(params.readAs).toEqual(['alice::abc'])
    expect(params.commands).toEqual([command])
    expect(params.disclosedContracts).toBeUndefined()
    expect(params.synchronizerId).toBeUndefined()
  })

  it('forwards disclosed contracts and derives the synchronizer id', () => {
    const disclosed: DisclosedContract[] = [
      { templateId: 'pkg:A:A', contractId: 'c1', createdEventBlob: 'b1' },
      {
        templateId: 'pkg:B:B',
        contractId: 'c2',
        createdEventBlob: 'b2',
        synchronizerId: 'sync::dom',
      },
    ]
    const params = toExecuteParams('bob::xyz', command, disclosed)
    expect(params.disclosedContracts).toEqual(disclosed)
    expect(params.synchronizerId).toBe('sync::dom')
  })

  it('omits the synchronizer id when no disclosure carries one', () => {
    const disclosed: DisclosedContract[] = [
      { templateId: 'pkg:A:A', contractId: 'c1', createdEventBlob: 'b1' },
    ]
    const params = toExecuteParams('bob::xyz', command, disclosed)
    expect(params.disclosedContracts).toEqual(disclosed)
    expect(params.synchronizerId).toBeUndefined()
  })
})
