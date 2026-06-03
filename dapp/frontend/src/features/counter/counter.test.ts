import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { normalizeCounterContract } from './counterSignature.ts'

const readText = (path: string): string => readFileSync(path, 'utf8')

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
              templateId:
                'b2e6c414cdb2341b2ae1167fdce0930291fec5ab4794fea436821109df54db99:Counter.Counter:Counter',
              createArgument: {
                issuer: 'fer::1220b218',
                count: '0',
                incrementors: [],
                viewers: { map: [] },
              },
              createdAt: '2026-05-21T10:00:00Z',
            },
          },
        },
      }),
      {
        contractId: '00773a63632467baef162a93681abe9635de0f53eb82b3c6b96b1340350b0c6ffbca',
        issuer: 'fer::1220b218',
        count: 0,
        incrementors: [],
        viewers: [],
        createdAt: '2026-05-21T10:00:00Z',
      },
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
                viewers: { map: [['viewer::fp', {}]] },
              },
            },
          },
        },
      }),
      {
        contractId: 'contract-2',
        issuer: 'alice::fp',
        count: 3,
        incrementors: [['bob::fp', 'delegation-1']],
        viewers: ['viewer::fp'],
        createdAt: undefined,
      },
    )
  })

  it('returns undefined for non-active variants (incomplete reassignments)', () => {
    assert.equal(
      normalizeCounterContract({
        contractEntry: {
          JsIncompleteAssigned: {
            createdEvent: { contractId: 'c', createArgument: { issuer: 'x' } },
          },
        },
      }),
      undefined,
    )
  })

  it('returns undefined for null or non-object input', () => {
    assert.equal(normalizeCounterContract(null), undefined)
    assert.equal(normalizeCounterContract(undefined), undefined)
    assert.equal(normalizeCounterContract('string'), undefined)
  })
})

describe('counter feature UI', () => {
  it('renders viewer and incrementor access controls as separate sections', () => {
    const src = readText('src/features/counter/Counter.tsx')
    const css = readText('src/features/counter/counter.css')

    assert.match(src, /<h3>{title}<\/h3>/)
    assert.match(src, /title="Viewers"/)
    assert.match(src, /There are no viewers\./)
    assert.match(src, /addTestId="add-viewer"/)
    assert.match(src, /buttonLabel="Add viewer"/)
    assert.match(src, /title="Incrementors"/)
    assert.match(src, /There are no incrementors\./)
    assert.match(src, /addTestId="add-incrementor"/)
    assert.match(src, /buttonLabel="Add incrementor"/)

    assert.match(css, /\.party-tools\s*{[^}]*flex-wrap: nowrap;/s)
    assert.match(css, /\.party-tools input\s*{[^}]*min-width: 0;[^}]*flex: 1 1 auto;/s)
    assert.match(css, /\.party-tools button\s*{[^}]*white-space: nowrap;/s)
  })

  it('keeps the transaction panel mounted but hidden', () => {
    const src = readText('src/features/counter/Counter.tsx')
    assert.match(src, /className="workspace-panel ui-hidden"/)
    assert.match(src, /data-testid="tx-status"/)
    assert.match(src, /Last transaction/)
  })

  it('makes disabled access controls visually distinct', () => {
    const css = readText('src/features/counter/counter.css')
    assert.match(css, /\.party-tools input:disabled\s*{[^}]*background: #e2e8f0;/s)
    assert.match(css, /\.party-tools input:disabled\s*{[^}]*color: var\(--muted\);/s)
    assert.match(css, /\.party-tools button\s*{[^}]*background: var\(--sky-2\);/s)
    assert.match(css, /\.party-tools button\s*{[^}]*color: #ffffff;/s)
    assert.match(css, /\.party-tools button:disabled\s*{[^}]*background: #e2e8f0;/s)
    assert.match(css, /\.party-tools button:disabled\s*{[^}]*border-color: #cbd5e1;/s)
  })

  it('renders viewer/incrementor lists as plain dash-marked text rows', () => {
    const css = readText('src/features/counter/counter.css')
    assert.match(css, /\.party-list li\s*{[^}]*min-width: 0;/s)
    assert.match(css, /\.party-list li\s*{[^}]*overflow-wrap: anywhere;/s)
    assert.match(css, /\.party-list li\s*{[^}]*color: var\(--slate-700\);/s)
    assert.match(css, /\.party-list li\s*{[^}]*display: flex;/s)
    assert.match(css, /\.party-list li::before\s*{[^}]*content: "-";/s)
    assert.match(css, /\.party-list li::before\s*{[^}]*color: var\(--muted\);/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*border-radius:/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*border:/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*background:/s)
  })

  it('uses the shared party formatter for the counter issuer and list rows', () => {
    const src = readText('src/features/counter/Counter.tsx')
    assert.match(
      src,
      /import \{[^}]*\bformatPartyId\b[^}]*\} from '\.\.\/\.\.\/utils\/formatPartyId\.js'/,
    )
    assert.match(src, /formatPartyId\(counter\.issuer\)/)
    assert.match(src, /formatPartyId\(partyId\)/)
    assert.doesNotMatch(src, /short\(counter\.issuer\)/)
  })
})
