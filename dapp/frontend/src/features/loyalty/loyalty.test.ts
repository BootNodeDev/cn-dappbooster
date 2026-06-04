import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addStampCommand,
  canStamp,
  createTallyCommand,
  grantViewerCommand,
  grantWriterCommand,
  isPartyIdShape,
  normalizeTallyContract,
  reconcileOrder,
  reconcileOverlay,
  stampStats,
  type TallyContract,
} from './loyaltySignature.ts'

const tally = (over: Partial<TallyContract> = {}): TallyContract => ({
  contractId: 'tally-1',
  issuer: 'merchant::fp',
  value: 0,
  writers: [],
  viewers: [],
  ...over,
})

describe('tally contract normalization', () => {
  it('normalizes a JsActiveContract row with value/writers field names', () => {
    assert.deepEqual(
      normalizeTallyContract({
        contractEntry: {
          JsActiveContract: {
            createdEvent: {
              contractId: 'c1',
              createArgument: {
                issuer: 'merchant::fp',
                value: '3',
                writers: [['staff::fp', 'delegation-1']],
                viewers: { map: [['holder::fp', {}]] },
              },
              createdAt: '2026-05-21T10:00:00Z',
            },
          },
        },
      }),
      {
        contractId: 'c1',
        issuer: 'merchant::fp',
        value: 3,
        writers: [['staff::fp', 'delegation-1']],
        viewers: ['holder::fp'],
        createdAt: '2026-05-21T10:00:00Z',
      },
    )
  })

  it('returns undefined for non-active variants and bad input', () => {
    assert.equal(
      normalizeTallyContract({
        contractEntry: { JsIncompleteAssigned: { createdEvent: { contractId: 'c' } } },
      }),
      undefined,
    )
    assert.equal(normalizeTallyContract(null), undefined)
    assert.equal(normalizeTallyContract('x'), undefined)
  })
})

describe('stampStats (10-slot punch card)', () => {
  it('fills slots within a card and counts completed cards as rewards', () => {
    assert.deepEqual(stampStats(0), { filled: 0, rewards: 0 })
    assert.deepEqual(stampStats(3), { filled: 3, rewards: 0 })
    assert.deepEqual(stampStats(9), { filled: 9, rewards: 0 })
    assert.deepEqual(stampStats(10), { filled: 0, rewards: 1 })
    assert.deepEqual(stampStats(20), { filled: 0, rewards: 2 })
    assert.deepEqual(stampStats(23), { filled: 3, rewards: 2 })
  })

  it('clamps negative values: wraps filled, floors rewards at 0', () => {
    assert.deepEqual(stampStats(-1), { filled: 9, rewards: 0 })
    assert.deepEqual(stampStats(-10), { filled: 0, rewards: 0 })
  })
})

describe('isPartyIdShape', () => {
  it('requires the hint::fingerprint separator', () => {
    assert.equal(isPartyIdShape('merchant::fp'), true)
    assert.equal(isPartyIdShape('  merchant::fp  '), true)
    assert.equal(isPartyIdShape('nospace'), false)
    assert.equal(isPartyIdShape(''), false)
  })
})

describe('canStamp', () => {
  it('allows the issuer and delegated writers, denies others', () => {
    assert.equal(canStamp(tally({ issuer: 'm::fp' }), 'm::fp'), true)
    assert.equal(canStamp(tally({ writers: [['s::fp', 'd1']] }), 's::fp'), true)
    assert.equal(canStamp(tally(), 'stranger::fp'), false)
  })
})

describe('command builders', () => {
  it('create uses string-zero value and empty writers/viewers', () => {
    assert.deepEqual(createTallyCommand('m::fp'), {
      CreateCommand: {
        templateId: '#quickstart-tally:Tally.Tally:Tally',
        createArguments: { issuer: 'm::fp', value: '0', writers: [], viewers: { map: [] } },
      },
    })
  })

  it('addStamp uses the writer delegation for a delegated staff party', () => {
    const cmd = addStampCommand(tally({ writers: [['s::fp', 'deleg-1']] }), 's::fp') as {
      ExerciseCommand: { templateId: string; choice: string; choiceArgument: unknown }
    }
    assert.equal(cmd.ExerciseCommand.templateId, '#quickstart-tally:Tally.Tally:TallyWriter')
    assert.equal(cmd.ExerciseCommand.choice, 'TallyWriter_Increment')
    assert.deepEqual(cmd.ExerciseCommand.choiceArgument, { tallyId: 'tally-1' })
  })

  it('addStamp uses Tally_Increment for the issuer', () => {
    const cmd = addStampCommand(tally({ issuer: 'm::fp' }), 'm::fp') as {
      ExerciseCommand: { templateId: string; choice: string }
    }
    assert.equal(cmd.ExerciseCommand.templateId, '#quickstart-tally:Tally.Tally:Tally')
    assert.equal(cmd.ExerciseCommand.choice, 'Tally_Increment')
  })

  it('addStamp prefers the issuer path even when the issuer is also a writer', () => {
    const cmd = addStampCommand(
      tally({ issuer: 'm::fp', writers: [['m::fp', 'deleg-1']] }),
      'm::fp',
    ) as { ExerciseCommand: { templateId: string; choice: string } }
    assert.equal(cmd.ExerciseCommand.templateId, '#quickstart-tally:Tally.Tally:Tally')
    assert.equal(cmd.ExerciseCommand.choice, 'Tally_Increment')
  })

  it('grantWriter and grantViewer target the right choices', () => {
    const w = grantWriterCommand(tally(), 'staff::fp') as {
      ExerciseCommand: { choice: string; choiceArgument: unknown }
    }
    assert.equal(w.ExerciseCommand.choice, 'Tally_GrantWriter')
    assert.deepEqual(w.ExerciseCommand.choiceArgument, { newWriter: 'staff::fp' })
    const v = grantViewerCommand(tally(), 'holder::fp') as {
      ExerciseCommand: { choice: string; choiceArgument: unknown }
    }
    assert.equal(v.ExerciseCommand.choice, 'Tally_GrantViewer')
    assert.deepEqual(v.ExerciseCommand.choiceArgument, { newViewer: 'holder::fp' })
  })
})

describe('reconcileOrder (stable card order across reloads)', () => {
  it('keeps order when contract ids are unchanged', () => {
    const a = tally({ contractId: 'a', issuer: 'm1::fp' })
    const b = tally({ contractId: 'b', issuer: 'm2::fp' })
    const result = reconcileOrder([a, b], [b, a])
    assert.deepEqual(
      result.map((r) => r.tally.contractId),
      ['a', 'b'],
    )
    assert.deepEqual(
      result.map((r) => r.from),
      ['a', 'b'],
    )
  })

  it('a recreated card (new id, same issuer) reuses its predecessor slot', () => {
    const a = tally({ contractId: 'a', issuer: 'm1::fp', value: 0 })
    const b = tally({ contractId: 'b', issuer: 'm2::fp' })
    const aNext = tally({ contractId: 'a2', issuer: 'm1::fp', value: 1 })
    const result = reconcileOrder([a, b], [b, aNext])
    assert.deepEqual(
      result.map((r) => r.tally.contractId),
      ['a2', 'b'],
    )
    assert.equal(result[0].from, 'a')
  })

  it('two recreated same-issuer cards each claim a distinct successor', () => {
    const a = tally({ contractId: 'a', issuer: 'm::fp' })
    const b = tally({ contractId: 'b', issuer: 'm::fp' })
    const a2 = tally({ contractId: 'a2', issuer: 'm::fp' })
    const b2 = tally({ contractId: 'b2', issuer: 'm::fp' })
    const result = reconcileOrder([a, b], [a2, b2])
    const ids = result.map((r) => r.tally.contractId)
    assert.equal(ids.length, 2)
    assert.equal(new Set(ids).size, 2)
  })

  it('appends a genuinely new card last', () => {
    const a = tally({ contractId: 'a', issuer: 'm1::fp' })
    const fresh = tally({ contractId: 'new', issuer: 'm2::fp' })
    const result = reconcileOrder([a], [a, fresh])
    assert.deepEqual(
      result.map((r) => r.tally.contractId),
      ['a', 'new'],
    )
    assert.equal(result[1].from, undefined)
  })
})

describe('reconcileOverlay (optimistic slot overlay after a stamp)', () => {
  it('keeps the overlay while the card is still filling', () => {
    // value 5 -> filled 5, overlay of 5 clicked slots survives intact
    assert.deepEqual(reconcileOverlay([2, 0, 4, 1, 3], 5), [2, 0, 4, 1, 3])
  })

  it('drops the overlay when the card completes and wraps to 0', () => {
    // value 10 -> filled 0: the fresh card must reseed empty, not stay full
    assert.equal(reconcileOverlay([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 10), undefined)
  })

  it('trims to the live filled count past a card boundary', () => {
    // value 11 -> filled 1: keep only the most recent clicked slot
    assert.deepEqual(reconcileOverlay([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 4], 11), [4])
  })
})

describe('tally contract normalization (edge cases)', () => {
  it('applies empty defaults for a flat record missing optional fields', () => {
    assert.deepEqual(
      normalizeTallyContract({
        contractEntry: {
          JsActiveContract: {
            createdEvent: {
              contractId: 'c2',
              createArgument: { issuer: 'm::fp' },
            },
          },
        },
      }),
      {
        contractId: 'c2',
        issuer: 'm::fp',
        value: 0,
        writers: [],
        viewers: [],
        createdAt: undefined,
      },
    )
  })

  it('reads map entries given as {key,value} objects', () => {
    const result = normalizeTallyContract({
      contractEntry: {
        JsActiveContract: {
          createdEvent: {
            contractId: 'c3',
            createArgument: {
              issuer: 'm::fp',
              value: '2',
              writers: { map: [{ key: 's::fp', value: 'deleg-9' }] },
              viewers: { map: [{ key: 'h::fp', value: {} }] },
            },
          },
        },
      },
    })
    assert.deepEqual(result?.writers, [['s::fp', 'deleg-9']])
    assert.deepEqual(result?.viewers, ['h::fp'])
  })
})
