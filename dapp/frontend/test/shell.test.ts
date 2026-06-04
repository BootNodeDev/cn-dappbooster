import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path: string): string => readFileSync(path, 'utf8')
const readJson = <T>(path: string): T => JSON.parse(readText(path)) as T

describe('dapp shell', () => {
  it('App is a thin shell: provider + ConnectionBar (features are optional/removable)', () => {
    const app = readText('src/App.tsx')

    // Shell invariant only — it must NOT require any specific feature to be
    // present, so removing every feature still leaves a passing skeleton.
    assert.match(app, /ConnectKitProvider/)
    assert.match(app, /import \{ ConnectionBar \} from '\.\/ConnectionBar'/)
    assert.match(app, /<ConnectionBar>/)
  })

  it('keeps counter domain logic out of the shell', () => {
    const app = readText('src/App.tsx')

    assert.doesNotMatch(app, /counterSignature/)
    assert.doesNotMatch(app, /COUNTER_(PACKAGE|TEMPLATE)_ID/)
    assert.doesNotMatch(app, /useExecute|useLedger/)
  })

  it('uses neutral starter copy, not counter branding', () => {
    const app = readText('src/App.tsx')

    assert.match(app, /appName: 'Canton dApp Starter'/)
    assert.doesNotMatch(app, /Counter dApp/)
  })

  it('ConnectionBar owns the wallet UX with auto-dismissing Sonner toasts', () => {
    const bar = readText('src/ConnectionBar.tsx')
    const pkg = readJson<{ dependencies?: Record<string, string> }>('package.json')

    assert.equal(typeof pkg.dependencies?.sonner, 'string')
    assert.match(bar, /from 'sonner'/)
    assert.match(bar, /<Toaster\b/)
    assert.match(bar, /toast\.success/)
    assert.match(bar, /toast\.error/)
  })

  it('renders a feature-independent workspace-ready marker when connected and unlocked', () => {
    const bar = readText('src/ConnectionBar.tsx')

    assert.match(bar, /data-testid="workspace-ready"/)
  })

  it('uses the shared party formatter and keeps the old network selector chrome out', () => {
    const bar = readText('src/ConnectionBar.tsx')
    const css = readText('src/index.css')

    assert.match(bar, /import \{[^}]*\bformatPartyId\b[^}]*\} from '\.\/utils\/formatPartyId'/)
    assert.match(bar, /formatPartyId\(party\.partyId\)/)
    assert.match(bar, /formatPartyId\(party\?\.partyId \?\? ''\)/)
    assert.doesNotMatch(bar, /network-separator/)
    assert.doesNotMatch(bar, /network-dot/)
    assert.doesNotMatch(css, /\.network-icon/)
  })

  it('caps the shell at 600px and hides ui-hidden panels', () => {
    const css = readText('src/index.css')

    assert.match(css, /\.shell\s*{[^}]*width: min\(600px, calc\(100vw - 28px\)\);/s)
    assert.match(css, /\.ui-hidden\s*{[^}]*display: none;/s)
  })

  it('keeps the shell index.css free of feature (counter) selectors', () => {
    // Removability invariant: feature CSS must live with the feature, so deleting
    // a feature folder leaves no orphaned selectors in the shell stylesheet.
    const css = readText('src/index.css')

    assert.doesNotMatch(css, /\.counter-/)
    assert.doesNotMatch(css, /\.party-/)
    assert.doesNotMatch(css, /\.access-/)
  })
})
