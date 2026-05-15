import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeCounterContract } from '../src/counterSignature.ts'

describe('counter contract normalization', () => {
  it('normalizes record-field createArgument payloads returned by the JSON API', () => {
    assert.deepEqual(
      normalizeCounterContract({
        contractId: 'contract-1',
        createArgument: {
          fields: [
            { label: 'issuer', value: 'alice::fingerprint' },
            { label: 'count', value: '3' },
            {
              label: 'incrementors',
              value: {
                map: [
                  { key: 'bob::fingerprint', value: 'delegation-contract' }
                ]
              }
            },
            {
              label: 'viewers',
              value: {
                map: [
                  { key: 'viewer::fingerprint', value: {} }
                ]
              }
            }
          ]
        },
        createdAt: '2026-05-14T12:00:00Z'
      }),
      {
        contractId: 'contract-1',
        issuer: 'alice::fingerprint',
        count: 3,
        incrementors: [['bob::fingerprint', 'delegation-contract']],
        viewers: ['viewer::fingerprint'],
        createdAt: '2026-05-14T12:00:00Z'
      }
    )
  })
})
