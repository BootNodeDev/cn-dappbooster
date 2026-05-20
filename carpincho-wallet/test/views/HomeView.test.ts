import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Reads HomeView source without importing WalletConnect runtime dependencies into this layout test.
const source = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')

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

    // Activity is hidden until an account exists whose transaction history can be listed.
    assert.match(homeView, /\{hasAccounts && <ActivityList transactions=\{v\.transactions\} \/>\}/)
  })
})
