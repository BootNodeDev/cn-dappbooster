import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Reads HomeView source without importing WalletConnect runtime dependencies into this layout test.
const source = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')

// Reads the approval card source so the pending-request layout contract can be checked in isolation.
const pendingActionCardSource = (): string =>
  readFileSync('src/components/ui/PendingActionCard.tsx', 'utf8')

describe('HomeView empty account layout', () => {
  // Scenario group: empty wallets should avoid exposing account-dependent body sections.
  it('renders only a vertically centered account card when no account exists', () => {
    // Scenario: the vault is unlocked, but the user has not created a Canton account yet.
    const homeView = source()

    // HomeView needs an explicit account-presence flag so every wallet body section shares one rule.
    assert.match(homeView, /const hasAccounts = accountsSorted\.length > 0/)

    // The empty account state is centered inside the wallet body instead of sitting at the top.
    assert.match(homeView, /!hasAccounts && 'min-h-\[calc\(100vh-10rem\)\] justify-center'/)

    // Pairing UI is only useful in the web WalletConnect flow, not in the extension popup.
    assert.match(homeView, /\{hasAccounts && !hasPending && !extensionMode && \(/)
    assert.doesNotMatch(homeView, /Listening on this browser/)

    // Activity is hidden while approval UI owns the wallet body space for a pending request.
    assert.match(
      homeView,
      /\{hasAccounts && !hasPending && <ActivityList transactions=\{v\.transactions\} \/>\}/,
    )

    // Pending approval UI expands between account and footer so its payload can scroll in place.
    assert.match(
      homeView,
      /hasAccounts && hasPending && 'h-\[calc\(100vh-12rem\)\] min-h-0 overflow-hidden pb-0'/,
    )
    assert.match(homeView, /'flex min-h-0 flex-1 flex-col overflow-hidden border-success\/55'/)
  })
})

describe('PendingActionCard approval layout', () => {
  // Scenario: pending Canton requests need a compact payload area with a label and one framed text box.
  it('renders payload text directly under the payload label inside one text box', () => {
    // The approval card source is inspected directly because this layout rule is component-local.
    const pendingActionCard = pendingActionCardSource()

    // Payload should not reuse JsonPreview because that primitive adds its own framed preview box.
    assert.doesNotMatch(pendingActionCard, /JsonPreview/)

    // The payload label stays visually aligned with the method row while the JSON text itself scrolls.
    assert.match(pendingActionCard, /payload:/)
    assert.match(pendingActionCard, /<pre/)
    assert.match(pendingActionCard, /min-h-0 flex-1 overflow-auto/)
    assert.match(pendingActionCard, /rounded-md border border-border bg-background\/60 p-3/)
  })
})
