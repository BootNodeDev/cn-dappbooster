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

  it('renders the network selector without the old separator or cross icon', () => {
    const app = readText('src/App.tsx')
    const css = readText('src/index.css')

    assert.doesNotMatch(app, /network-separator/)
    assert.doesNotMatch(app, /&gt;/)
    assert.doesNotMatch(css, /\.network-icon/)
    assert.match(app, /network-dot/)
  })
})
