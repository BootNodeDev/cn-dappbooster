import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCantonToken } from '../src/canton-token.ts'

const b64urlDecode = (value: string): Buffer => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

describe('createCantonToken', () => {
  it('produces the same HS256 token as canton-base/scripts/mint-token.mjs for the pinned inputs', () => {
    const token = createCantonToken({
      subject: 'wallet-service',
      audience: 'https://canton-base.local',
      secret: 'unsafe'
    })

    assert.equal(
      token,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ3YWxsZXQtc2VydmljZSIsImF1ZCI6Imh0dHBzOi8vY2FudG9uLWJhc2UubG9jYWwifQ.ecGaga18iUJBlhKatz-7sW2sXv-Oua9sw4NV0M1yse0'
    )
  })

  it('decodes to the canonical header and payload', () => {
    const token = createCantonToken({
      subject: 'wallet-service',
      audience: 'https://canton-base.local',
      secret: 'unsafe'
    })
    const [header, payload, signature] = token.split('.')

    assert.deepEqual(JSON.parse(b64urlDecode(header).toString('utf8')), { alg: 'HS256', typ: 'JWT' })
    assert.deepEqual(JSON.parse(b64urlDecode(payload).toString('utf8')), {
      sub: 'wallet-service',
      aud: 'https://canton-base.local'
    })
    assert.equal(signature.length, 43)
  })

  it('throws when subject is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: '', audience: 'aud', secret: 'sec' }),
      /subject is required/
    )
  })

  it('throws when audience is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: '', secret: 'sec' }),
      /CANTON_AUTH_AUDIENCE is required/
    )
  })

  it('throws when secret is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: 'aud', secret: '' }),
      /CANTON_AUTH_SECRET is required/
    )
  })
})
