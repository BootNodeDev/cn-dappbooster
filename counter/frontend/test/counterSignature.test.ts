import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeCounterContract } from '../src/counterSignature.ts'

describe('counter contract normalization', () => {
  // Real shape returned by the participant-native /v2/state/active-contracts
  // endpoint via wallet-service ledgerApi pass-through. The contract details
  // are nested under contractEntry.JsActiveContract.createdEvent; createArgument
  // is a flat record (not record-field form). This is the shape the dApp
  // actually receives since PR-A dropped the SDK-side shim.
  it('normalizes a JsActiveContract row from /v2/state/active-contracts', () => {
    assert.deepEqual(
      normalizeCounterContract({
        workflowId: '',
        contractEntry: {
          JsActiveContract: {
            createdEvent: {
              offset: 305,
              nodeId: 0,
              contractId: '00773a63632467baef162a93681abe9635de0f53eb82b3c6b96b1340350b0c6ffbca',
              templateId: 'b2e6c414cdb2341b2ae1167fdce0930291fec5ab4794fea436821109df54db99:Counter.Counter:Counter',
              createArgument: {
                issuer: 'fer::1220b218',
                count: '0',
                incrementors: [],
                viewers: { map: [] }
              },
              createdAt: '2026-05-21T10:00:00Z'
            }
          }
        }
      }),
      {
        contractId: '00773a63632467baef162a93681abe9635de0f53eb82b3c6b96b1340350b0c6ffbca',
        issuer: 'fer::1220b218',
        count: 0,
        incrementors: [],
        viewers: [],
        createdAt: '2026-05-21T10:00:00Z'
      }
    )
  })

  it('normalizes incrementors and viewers from the participant-native shape', () => {
    assert.deepEqual(
      normalizeCounterContract({
        contractEntry: {
          JsActiveContract: {
            createdEvent: {
              contractId: 'contract-2',
              createArgument: {
                issuer: 'alice::fp',
                count: '3',
                incrementors: [['bob::fp', 'delegation-1']],
                viewers: { map: [['viewer::fp', {}]] }
              }
            }
          }
        }
      }),
      {
        contractId: 'contract-2',
        issuer: 'alice::fp',
        count: 3,
        incrementors: [['bob::fp', 'delegation-1']],
        viewers: ['viewer::fp'],
        createdAt: undefined
      }
    )
  })

  it('returns undefined for non-active variants (incomplete reassignments)', () => {
    assert.equal(
      normalizeCounterContract({
        contractEntry: {
          JsIncompleteAssigned: { createdEvent: { contractId: 'c', createArgument: { issuer: 'x' } } }
        }
      }),
      undefined
    )
  })

  it('returns undefined for null or non-object input', () => {
    assert.equal(normalizeCounterContract(null), undefined)
    assert.equal(normalizeCounterContract(undefined), undefined)
    assert.equal(normalizeCounterContract('string'), undefined)
  })
})
