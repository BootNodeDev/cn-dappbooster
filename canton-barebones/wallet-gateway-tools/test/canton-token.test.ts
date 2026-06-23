import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCantonToken } from '../src/canton-token.ts'

const b64urlDecode = (value: string): Buffer => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

describe('createCantonToken', () => {
  it('produces the pinned LocalNet HS256 token for known inputs', () => {
    // Scenario: wallet-gateway-tools must keep the exact LocalNet JWT shape so
    // generated tokens work across app-user Ledger, Validator, Scan, and Registry endpoints.
    const token = createCantonToken({
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })

    assert.equal(
      token,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCJ9.G9aLv-IF5X0WmIkbR10f48i-7it5LlgwpJEZ4Ce2Y-E',
    )
  })

  it('decodes to the canonical header and payload', () => {
    // Scenario: the generated bearer token must remain a simple HS256 JWT
    // with only the subject and audience claims expected by LocalNet dev auth.
    const token = createCantonToken({
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })
    const [header, payload, signature] = token.split('.')

    assert.deepEqual(JSON.parse(b64urlDecode(header).toString('utf8')), {
      alg: 'HS256',
      typ: 'JWT',
    })
    assert.deepEqual(JSON.parse(b64urlDecode(payload).toString('utf8')), {
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    })
    assert.equal(signature.length, 43)
  })

  it('throws when subject is empty', () => {
    // Scenario: a token without subject cannot identify the ledger user.
    assert.throws(
      () => createCantonToken({ subject: '', audience: 'aud', secret: 'sec' }),
      /subject is required/,
    )
  })

  it('throws when audience is empty', () => {
    // Scenario: Canton validates the audience, so missing it must fail locally.
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: '', secret: 'sec' }),
      /audience is required/,
    )
  })

  it('throws when secret is empty', () => {
    // Scenario: self-signed mode must not emit unsigned or weakly configured tokens.
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: 'aud', secret: '' }),
      /AUTH_SECRET is required/,
    )
  })
})
