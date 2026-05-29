import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatPartyId } from '../src/utils/formatPartyId.ts'

describe('party id formatting', () => {
  it('keeps the human-readable party name and shortens the namespace fingerprint', () => {
    // Scenario: Canton parties are displayed as name::namespace. The name is
    // meaningful to users, while the namespace is long identity material that
    // should remain recognizable without taking over the UI.
    const partyId = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'

    // The formatted value should preserve the name and show enough namespace
    // prefix/suffix to distinguish parties that share a visible name.
    assert.equal(formatPartyId(partyId), 'nico::1220df...0b1cbb46')
  })

  it('falls back to generic shortening for party ids without a namespace separator', () => {
    // Scenario: test fixtures and malformed wallet data may not include the
    // Canton name::namespace separator, but the UI should still render a stable
    // compact value instead of exposing an unbounded string.
    const partyId = 'viewer1-1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2d05fe52e'

    // The fallback should use the same compact shape as other non-party IDs in
    // the app so unexpected values remain readable.
    assert.equal(formatPartyId(partyId), 'viewer1-1220...d05fe52e')
  })
})
