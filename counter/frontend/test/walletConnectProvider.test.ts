import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createWalletConnectProvider } from '../src/walletConnectProvider.ts'

describe('WalletConnect provider', () => {
  it('emits the pairing URI without opening a browser tab', async () => {
    let opened = false
    const previousWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { origin: 'http://localhost:3012' },
        open: () => {
          opened = true
          return null
        }
      }
    })

    try {
      let pairingUri: string | undefined
      const fakeClient = {
        connect: async () => ({
          uri: 'wc:test-uri',
          approval: async () => ({ topic: 'session-topic' })
        }),
        on: () => fakeClient,
        request: async () => null,
        disconnect: async () => undefined,
        session: {
          getAll: () => []
        }
      }
      const provider = createWalletConnectProvider({
        projectId: 'project-id',
        chainId: 'canton:local',
        metadata: {
          name: 'Counter dApp',
          description: 'Counter app for the Canton base',
          url: 'http://localhost:3012',
          icons: []
        },
        onUri: uri => { pairingUri = uri },
        signClientFactory: async () => fakeClient
      })

      const result = await provider.request({ method: 'connect' })

      assert.deepEqual(result, { isConnected: true, isNetworkConnected: true })
      assert.equal(pairingUri, 'wc:test-uri')
      assert.equal(opened, false)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow
      })
    }
  })
})
