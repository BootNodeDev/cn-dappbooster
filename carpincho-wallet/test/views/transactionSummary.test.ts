import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  commandCount,
  commandSummary,
  executeParams,
  optionalString,
  transactionCommands,
} from '@/views/home/transactionSummary.ts'

describe('executeParams', () => {
  it('injects the active party and defaults actAs / readAs from a plain object', () => {
    assert.deepEqual(executeParams({ commands: [] }, 'alice::fp'), {
      commands: [],
      partyId: 'alice::fp',
      actAs: ['alice::fp'],
      readAs: ['alice::fp'],
    })
  })

  it('preserves caller-supplied actAs and readAs arrays', () => {
    assert.deepEqual(executeParams({ actAs: ['bob::fp'], readAs: ['carol::fp'] }, 'alice::fp'), {
      partyId: 'alice::fp',
      actAs: ['bob::fp'],
      readAs: ['carol::fp'],
    })
  })

  it('defaults readAs to actAs when readAs is absent', () => {
    assert.deepEqual(executeParams({ actAs: ['bob::fp'] }, 'alice::fp'), {
      partyId: 'alice::fp',
      actAs: ['bob::fp'],
      readAs: ['bob::fp'],
    })
  })

  it('treats non-object params as empty and falls back to the active party', () => {
    assert.deepEqual(executeParams(null, 'alice::fp'), {
      partyId: 'alice::fp',
      actAs: ['alice::fp'],
      readAs: ['alice::fp'],
    })
    assert.deepEqual(executeParams(['ignored'], 'alice::fp'), {
      partyId: 'alice::fp',
      actAs: ['alice::fp'],
      readAs: ['alice::fp'],
    })
  })
})

describe('transactionCommands and commandCount', () => {
  it('returns the command array when present', () => {
    const commands = [{ CreateCommand: {} }]
    assert.deepEqual(transactionCommands({ commands }), commands)
    assert.equal(commandCount({ commands }), 1)
  })

  it('returns undefined when commands are missing or not an array', () => {
    assert.equal(transactionCommands({}), undefined)
    assert.equal(transactionCommands({ commands: 'nope' }), undefined)
    assert.equal(commandCount({}), undefined)
  })
})

describe('commandSummary', () => {
  it('falls back to a generic label with no commands', () => {
    assert.equal(commandSummary({}), 'Canton transaction')
    assert.equal(commandSummary({ commands: [] }), 'Canton transaction')
  })

  it('uses the first command kind for a single command', () => {
    assert.equal(commandSummary({ commands: [{ CreateCommand: {} }] }), 'CreateCommand')
  })

  it('appends a remainder count for multiple commands', () => {
    assert.equal(
      commandSummary({ commands: [{ CreateCommand: {} }, { ExerciseCommand: {} }] }),
      'CreateCommand + 1 more',
    )
  })

  it('counts commands when the first entry has no usable kind', () => {
    assert.equal(commandSummary({ commands: ['raw', 'raw'] }), '2 commands')
    assert.equal(commandSummary({ commands: [{}] }), '1 command')
  })
})

describe('optionalString', () => {
  it('keeps non-empty strings and drops everything else', () => {
    assert.equal(optionalString('value'), 'value')
    assert.equal(optionalString(''), undefined)
    assert.equal(optionalString(undefined), undefined)
    assert.equal(optionalString(42), undefined)
  })
})
