import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CARPINCHO_EXTENSION_TARGET, createExtensionWalletProvider } from '../src/extensionProvider.ts'
import { createPreferredProvider } from '../src/wallet.ts'

const fakeProvider = {
  request: async () => null,
  on: () => fakeProvider,
  emit: () => false,
  removeListener: () => fakeProvider
}

describe('extension wallet provider', () => {
  it('uses the Carpincho extension target', async () => {
    let detectCalled = false
    let providerCalled = false
    const provider = await createExtensionWalletProvider({
      adapterFactory: () => ({
        detect: async () => {
          detectCalled = true
          return true
        },
        provider: () => {
          providerCalled = true
          return fakeProvider
        }
      })
    })

    assert.equal(CARPINCHO_EXTENSION_TARGET, 'carpincho-wallet')
    assert.equal(provider, fakeProvider)
    assert.equal(detectCalled, true)
    assert.equal(providerCalled, true)
  })

  it('falls back when the extension is not detected', async () => {
    const provider = await createExtensionWalletProvider({
      adapterFactory: () => ({
        detect: async () => false,
        provider: () => fakeProvider
      })
    })

    assert.equal(provider, undefined)
  })

  it('prefers extension provider over WalletConnect', async () => {
    let walletConnectCreated = false
    const selected = await createPreferredProvider({
      chainId: 'canton:local',
      onUri: () => undefined,
      extensionProviderFactory: async () => fakeProvider,
      walletConnectProviderFactory: () => {
        walletConnectCreated = true
        return fakeProvider
      }
    })

    assert.equal(selected.provider, fakeProvider)
    assert.equal(selected.providerType, 'browser')
    assert.equal(walletConnectCreated, false)
  })
})
