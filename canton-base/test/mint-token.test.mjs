import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCantonToken } from '../scripts/mint-token.mjs'

const b64urlDecode = (value) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

describe('Canton token generation', () => {
  it('creates the HS256 JWT Canton accepts for local auth', () => {
    const token = createCantonToken({
      subject: 'wallet-service',
      audience: 'https://canton-base.local',
      secret: 'unsafe',
    })
    const [header, payload, signature] = token.split('.')

    assert.equal(
      token,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ3YWxsZXQtc2VydmljZSIsImF1ZCI6Imh0dHBzOi8vY2FudG9uLWJhc2UubG9jYWwifQ.ecGaga18iUJBlhKatz-7sW2sXv-Oua9sw4NV0M1yse0',
    )
    assert.deepEqual(JSON.parse(b64urlDecode(header).toString('utf8')), {
      alg: 'HS256',
      typ: 'JWT',
    })
    assert.deepEqual(JSON.parse(b64urlDecode(payload).toString('utf8')), {
      sub: 'wallet-service',
      aud: 'https://canton-base.local',
    })
    assert.equal(signature.length, 43)
  })
})
