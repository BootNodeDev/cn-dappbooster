import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const walletGatewayConfigPath = path.join(projectRoot, 'config/wallet-gateway/localnet.json')

describe('wallet-gateway LocalNet config', () => {
  it('keeps only the required official wallet-gateway config', () => {
    // Scenario: the official wallet-gateway package already provides runtime
    // defaults for server and logging. The LocalNet config should only keep the
    // stack-specific values that point it at canton-barebones.
    const config = JSON.parse(readFileSync(walletGatewayConfigPath, 'utf8'))

    // Setup expectation: durable storage and bootstrap are the required local
    // values; optional defaults should stay inside the official package.
    assert.equal(config.kernel.id, 'wallet-gateway')
    assert.ok(config.store)
    assert.ok(config.signingStore)
    assert.ok(config.bootstrap)

    // Expected behavior: no optional defaults are copied into this repo, which
    // keeps Docker wiring and runtime config easier to review.
    assert.equal(config.logging, undefined)
    assert.equal(config.server, undefined)
    assert.equal(config.bootstrap.networks[0].adminAuth, undefined)
  })
})
