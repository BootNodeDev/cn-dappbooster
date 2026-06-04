import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addStampCommand,
  canStamp,
  createTallyCommand,
  grantViewerCommand,
  grantWriterCommand,
  normalizeTallyContract,
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
    assert.deepEqual(stampStats(10), { filled: 0, rewards: 1 })
    assert.deepEqual(stampStats(23), { filled: 3, rewards: 2 })
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
