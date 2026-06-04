import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path: string): string => readFileSync(path, 'utf8')
const readJson = <T>(path: string): T => JSON.parse(readText(path)) as T

describe('dapp shell', () => {
  it('App is a thin shell: provider + ConnectionBar (features are optional/removable)', () => {
    const app = readText('src/App.tsx')
    assert.match(app, /ConnectKitProvider/)
    assert.match(app, /import \{ ConnectionBar \} from '\.\/ConnectionBar'/)
    assert.match(app, /<ConnectionBar>/)
  })

  it('mounts the shared ThemeProvider, ToastProvider, and TooltipProvider', () => {
    const main = readText('src/main.tsx')
    const app = readText('src/App.tsx')
    assert.match(main, /ThemeProvider/)
    assert.match(app, /ToastProvider/)
    assert.match(app, /TooltipProvider/)
  })

  it('keeps loyalty domain logic out of the shell', () => {
    const app = readText('src/App.tsx')
    assert.doesNotMatch(app, /loyaltySignature/)
    assert.doesNotMatch(app, /TALLY_(PACKAGE|TEMPLATE)_ID/)
    assert.doesNotMatch(app, /useExecute|useLedger/)
  })

  it('uses neutral starter copy, not feature branding', () => {
    const app = readText('src/App.tsx')
    assert.match(app, /appName: 'Canton dApp Starter'/)
    assert.doesNotMatch(app, /Counter dApp/)
  })

  it('ConnectionBar uses the shared toast system, not sonner', () => {
    const bar = readText('src/ConnectionBar.tsx')
    const pkg = readJson<{ dependencies?: Record<string, string> }>('package.json')
    assert.equal(pkg.dependencies?.sonner, undefined)
    assert.doesNotMatch(bar, /from 'sonner'/)
    assert.match(bar, /from '@\/components\/ui\/toast'/)
    assert.match(bar, /toast\.success/)
    assert.match(bar, /toast\.error/)
  })

  it('renders a feature-independent workspace-ready marker and a theme toggle', () => {
    const bar = readText('src/ConnectionBar.tsx')
    assert.match(bar, /data-testid="workspace-ready"/)
    assert.match(bar, /data-testid="theme-toggle"/)
  })

  it('uses the shared party formatter', () => {
    const bar = readText('src/ConnectionBar.tsx')
    assert.match(bar, /formatPartyId\(party\.partyId\)/)
  })

  it('adopts tailwind v4 + drops sonner in package.json', () => {
    const pkg = readJson<{
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }>('package.json')
    assert.equal(typeof pkg.devDependencies?.tailwindcss, 'string')
    assert.equal(typeof pkg.devDependencies?.['@tailwindcss/vite'], 'string')
    assert.equal(pkg.dependencies?.sonner, undefined)
  })
})
