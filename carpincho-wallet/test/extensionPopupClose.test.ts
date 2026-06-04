import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const homeViewSource = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')
const pendingActionsSource = (): string =>
  readFileSync('src/views/home/usePendingActions.ts', 'utf8')

describe('extension popup request responses', () => {
  it('closes the extension popup after approving or rejecting wallet requests', () => {
    const homeView = homeViewSource()

    // HomeView owns the popup-close callback and wires it into the pending-actions hook.
    assert.match(homeView, /const closeExtensionPopup = useCallback/)
    assert.match(homeView, /window\.close\(\)/)
    assert.match(homeView, /usePendingActions\(\{[\s\S]*closeExtensionPopup,/)

    // The approve / reject handlers each close the popup once they have responded.
    const pendingActions = pendingActionsSource()
    assert.match(pendingActions, /onApproveProposal[\s\S]*closeExtensionPopup\(\)/)
    assert.match(pendingActions, /onRejectProposal[\s\S]*closeExtensionPopup\(\)/)
    assert.match(pendingActions, /onApproveSign[\s\S]*closeExtensionPopup\(\)/)
    assert.match(pendingActions, /onRejectSign[\s\S]*closeExtensionPopup\(\)/)
    assert.match(pendingActions, /onApproveExecute[\s\S]*closeExtensionPopup\(\)/)
    assert.match(pendingActions, /onRejectExecute[\s\S]*closeExtensionPopup\(\)/)
  })
})
