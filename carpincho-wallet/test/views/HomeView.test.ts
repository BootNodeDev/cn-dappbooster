import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Reads HomeView source without importing WalletConnect runtime dependencies into this layout test.
const source = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')

// Reads the extracted pending-actions section so its layout contract can be checked in isolation.
const pendingActionsSectionSource = (): string =>
  readFileSync('src/views/home/PendingActionsSection.tsx', 'utf8')

// Reads the extracted pending-actions hook that owns the prepare → sign → execute → record pipeline.
const pendingActionsSource = (): string =>
  readFileSync('src/views/home/usePendingActions.ts', 'utf8')

// Reads the approval card source so the pending-request layout contract can be checked in isolation.
const pendingActionCardSource = (): string =>
  readFileSync('src/components/ui/PendingActionCard.tsx', 'utf8')

describe('HomeView account body layout', () => {
  // The empty-account state is unreachable: onboarding owns the 0-account case and the
  // last account cannot be removed, so HomeView always renders with at least one account.
  it('no longer carries an empty-account centering branch', () => {
    const homeView = source()
    assert.doesNotMatch(homeView, /hasAccounts/)
    assert.doesNotMatch(homeView, /min-h-\[calc\(100vh-10rem\)\] justify-center/)
  })

  it('renders the add-account sheet with the shared CreateAccountForm', () => {
    const homeView = source()
    assert.match(homeView, /import \{ CreateAccountForm \} from '@\/components\/CreateAccountForm'/)
    assert.match(homeView, /<CreateAccountForm/)
    assert.doesNotMatch(homeView, /AddAccountView/)
  })

  it('expands the pending-actions section to own the wallet body', () => {
    const pendingActionsSection = pendingActionsSectionSource()
    assert.match(
      pendingActionsSection,
      /'flex min-h-0 flex-1 flex-col overflow-hidden border-success\/55'/,
    )
  })
})

describe('HomeView transaction activity recording', () => {
  // Scenario group: executed transactions should persist both the signed payload source and readable command input.
  it('records prepared transaction bytes and original commands for activity history', () => {
    // Scenario: after Canton prepares and executes a transaction, Activity needs audit data beyond the hash.
    const pendingActions = pendingActionsSource()

    // The prepared transaction is the base64 payload that produced the signed hash, so it must be retained.
    assert.match(pendingActions, /preparedTransaction: prepared\.preparedTransaction/)

    // The original command array is the readable dApp request data shown in Activity.
    assert.match(pendingActions, /commands: transactionCommands\(pendingExecute\.params\)/)
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
