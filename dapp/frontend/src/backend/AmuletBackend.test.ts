import { describe, expect, it } from 'vitest'
import { packageIdOf } from './AmuletBackend'

// Disclosed splice contracts must be qualified with the package the live LocalNet
// deployed, which can differ from the configured/fallback one. The package id is
// derived from a live `packageId:Module:Entity` template id returned by SCAN.
describe('packageIdOf', () => {
  it('extracts the package id from a qualified template id', () => {
    expect(packageIdOf('3ca1343ab26b453d:Splice.AmuletRules:AmuletRules')).toBe('3ca1343ab26b453d')
  })

  it('returns the whole string when there is no module/entity', () => {
    expect(packageIdOf('3ca1343ab26b453d')).toBe('3ca1343ab26b453d')
  })

  it('returns empty string for an empty template id', () => {
    expect(packageIdOf('')).toBe('')
  })
})
