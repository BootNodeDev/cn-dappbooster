import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path: string): string => readFileSync(path, 'utf8')
const readJson = <T>(path: string): T => JSON.parse(readText(path)) as T

describe('counter app UI shell', () => {
  it('uses auto dismissing Sonner toasts instead of inline alert blocks', () => {
    const app = readText('src/App.tsx')
    const pkg = readJson<{ dependencies?: Record<string, string> }>('package.json')

    assert.equal(typeof pkg.dependencies?.sonner, 'string')
    assert.match(app, /from 'sonner'/)
    assert.match(app, /<Toaster\b/)
    assert.match(app, /toast\.success/)
    assert.match(app, /toast\.error/)
    assert.doesNotMatch(app, /className="info dismissible"/)
    assert.doesNotMatch(app, /className="error dismissible"/)
  })

  it('keeps the old network selector chrome out of the shell', () => {
    // Scenario: the network selector was removed from the shell. The old
    // separator, cross icon, and dot indicator must not reappear.
    const app = readText('src/App.tsx')
    const css = readText('src/index.css')

    assert.doesNotMatch(app, /network-separator/)
    assert.doesNotMatch(app, /&gt;/)
    assert.doesNotMatch(css, /\.network-icon/)
    assert.doesNotMatch(app, /network-dot/)
  })

  it('renders viewer and incrementor access controls as separate sections', () => {
    // Scenario: issuer access management must expose independent viewer and
    // incrementor flows so each role can use its own draft input and submit action.
    const app = readText('src/App.tsx')
    const css = readText('src/index.css')

    // The counter card should present viewer access with its own empty/list
    // state and viewer-specific add button.
    assert.match(app, /<h3>{title}<\/h3>/)
    assert.match(app, /title="Viewers"/)
    assert.match(app, /There are no viewers\./)
    assert.match(app, /addTestId="add-viewer"/)
    assert.match(app, /buttonLabel="Add viewer"/)

    // The counter card should present incrementor access separately from viewers,
    // backed by the incrementor command that grants write capability.
    assert.match(app, /title="Incrementors"/)
    assert.match(app, /There are no incrementors\./)
    assert.match(app, /addTestId="add-incrementor"/)
    assert.match(app, /buttonLabel="Add incrementor"/)

    // Reader and writer forms should keep their input and button on the same
    // row; the input shrinks instead of forcing the button onto a second line.
    assert.match(css, /\.party-tools\s*{[^}]*flex-wrap: nowrap;/s)
    assert.match(css, /\.party-tools input\s*{[^}]*min-width: 0;[^}]*flex: 1 1 auto;/s)
    assert.match(css, /\.party-tools button\s*{[^}]*white-space: nowrap;/s)
  })

  it('sets the app shell max width to 600 pixels', () => {
    // Scenario: the counter app needs a wider fixed container so the counter
    // controls have more horizontal room without changing the responsive edge
    // padding that protects small mobile viewports.
    const css = readText('src/index.css')

    // The shell width should cap at 600px on wide screens while still shrinking
    // to the viewport-minus-padding expression on narrow screens.
    assert.match(css, /\.shell\s*{[^}]*width: min\(600px, calc\(100vw - 28px\)\);/s)
  })

  it('keeps transaction and wallet capability panels mounted but hidden', () => {
    // Scenario: transaction status and signing controls are still rendered for
    // existing tests, but they should not take space or appear in the visible UI.
    const app = readText('src/App.tsx')
    const css = readText('src/index.css')

    // Both panels keep their test IDs and content, while sharing the hidden
    // class that removes them from the visual layout.
    assert.match(app, /className="workspace-panel ui-hidden"/)
    assert.match(app, /data-testid="tx-status"/)
    assert.match(app, /Last transaction/)
    assert.match(app, /data-testid="signing-panel"/)
    assert.match(app, /Wallet capability/)

    // The hidden class uses display none so these mounted panels do not affect
    // spacing, focus order, or visual composition.
    assert.match(css, /\.ui-hidden\s*{[^}]*display: none;/s)
  })

  it('makes disabled access controls visually distinct', () => {
    // Scenario: non-issuer parties can see access controls but cannot use them,
    // so disabled form controls need stronger visual treatment than opacity alone.
    const css = readText('src/index.css')

    // Disabled party inputs should read as inactive through muted colors and a
    // blocked cursor, while disabled add buttons should use the same inactive
    // treatment for visual consistency.
    assert.match(css, /\.party-tools input:disabled\s*{[^}]*background: #e2e8f0;/s)
    assert.match(css, /\.party-tools input:disabled\s*{[^}]*color: var\(--muted\);/s)
    assert.match(css, /\.party-tools button\s*{[^}]*background: var\(--sky-2\);/s)
    assert.match(css, /\.party-tools button\s*{[^}]*color: #ffffff;/s)
    assert.match(css, /\.party-tools button:disabled\s*{[^}]*background: #e2e8f0;/s)
    assert.match(css, /\.party-tools button:disabled\s*{[^}]*border-color: #cbd5e1;/s)
  })

  it('renders viewer and incrementor lists as plain text rows', () => {
    // Scenario: viewer and incrementor parties are reference data inside each
    // access section, so they should read like a simple list instead of badges.
    const css = readText('src/index.css')

    // List rows should preserve wrapping and readable text styling without
    // badge chrome such as borders, rounded pills, padding, or filled surfaces.
    assert.match(css, /\.party-list li\s*{[^}]*min-width: 0;/s)
    assert.match(css, /\.party-list li\s*{[^}]*overflow-wrap: anywhere;/s)
    assert.match(css, /\.party-list li\s*{[^}]*color: var\(--slate-700\);/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*border:/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*border-radius:/s)
    assert.doesNotMatch(css, /\.party-list li\s*{[^}]*background:/s)
  })

  it('adds a text marker to viewer and incrementor list rows', () => {
    // Scenario: access party lists need a visible list affordance without
    // turning each value into a badge or card.
    const css = readText('src/index.css')

    // Each row should render a lightweight dash marker before the formatted
    // party value so the section scans like a list.
    assert.match(css, /\.party-list li\s*{[^}]*display: flex;/s)
    assert.match(css, /\.party-list li::before\s*{[^}]*content: "-";/s)
    assert.match(css, /\.party-list li::before\s*{[^}]*color: var\(--muted\);/s)
  })

  it('uses the shared party formatter for displayed party ids', () => {
    // Scenario: party IDs appear in multiple places, including the connected
    // party, issuer field, and viewer/incrementor lists, so they must all use
    // one helper to keep truncation behavior consistent.
    const app = readText('src/App.tsx')

    // The app should import the shared party formatter and use it for visible
    // party values instead of calling the generic non-party shortener directly.
    assert.match(app, /import \{ formatPartyId \} from '\.\/utils\/formatPartyId\.js'/)
    assert.match(app, /formatPartyId\(partyId\)/)
    assert.match(app, /formatPartyId\(party\.partyId\)/)
    assert.match(app, /formatPartyId\(party\?\.partyId \?\? ''\)/)
    assert.match(app, /formatPartyId\(counter\.issuer\)/)
    assert.doesNotMatch(app, /short\(counter\.issuer\)/)
  })
})
