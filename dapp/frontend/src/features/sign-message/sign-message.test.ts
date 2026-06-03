import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path: string): string => readFileSync(path, 'utf8')

describe('sign-message feature', () => {
  it('mounts the signMessage harness hidden (panel + input + trigger + output)', () => {
    const src = readText('src/features/sign-message/SignMessageDemo.tsx')
    assert.match(src, /className="workspace-panel ui-hidden"/)
    assert.match(src, /data-testid="signing-panel"/)
    assert.match(src, /data-testid="sign-input"/)
    assert.match(src, /data-testid="sign-message"/)
    assert.match(src, /data-testid="signature-output"/)
    assert.match(src, /Wallet capability/)
  })

  it('uses the kit signMessage hook and toasts on completion', () => {
    const src = readText('src/features/sign-message/SignMessageDemo.tsx')
    assert.match(src, /useSignMessage/)
    assert.match(src, /from 'canton-connect-kit'/)
    assert.match(src, /toast\.success/)
  })

  it('does not depend on counter styles', () => {
    const src = readText('src/features/sign-message/SignMessageDemo.tsx')
    assert.doesNotMatch(src, /counter-card/)
  })
})
