import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')

describe('extension popup request responses', () => {
  it('closes the extension popup after approving or rejecting wallet requests', () => {
    const homeView = source()

    assert.match(homeView, /const closeExtensionPopup = useCallback/)
    assert.match(homeView, /window\.close\(\)/)
    assert.match(homeView, /onApproveProposal[\s\S]*closeExtensionPopup\(\)/)
    assert.match(homeView, /onRejectProposal[\s\S]*closeExtensionPopup\(\)/)
    assert.match(homeView, /onApproveSign[\s\S]*closeExtensionPopup\(\)/)
    assert.match(homeView, /onRejectSign[\s\S]*closeExtensionPopup\(\)/)
    assert.match(homeView, /onApproveExecute[\s\S]*closeExtensionPopup\(\)/)
    assert.match(homeView, /onRejectExecute[\s\S]*closeExtensionPopup\(\)/)
  })
})
