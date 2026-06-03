import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  directConnectionUpdateFromProviderResponse,
  normalizeDirectConnectionOrigin,
} from '@/extension/directConnectionState'

describe('extension direct connection state', () => {
  it('normalizes direct dApp URLs to http origins', () => {
    // Scenario: the content script sends window.location.origin, but callers may pass a full page URL.
    const result = normalizeDirectConnectionOrigin('http://localhost:3012/counter')

    // The background should persist only the origin so route changes still match the connected dApp.
    assert.equal(result, 'http://localhost:3012')
  })

  it('records an origin after a successful direct connect response', () => {
    // Scenario: a dApp connected through the injected provider and received an isConnected=true result.
    const result = directConnectionUpdateFromProviderResponse({
      origin: 'http://localhost:3012',
      request: { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      response: { jsonrpc: '2.0', id: 'connect-1', result: { isConnected: true } },
    })

    // The background should remember this origin as directly connected.
    assert.deepEqual(result, { action: 'remember', origin: 'http://localhost:3012' })
  })

  it('does not record an origin after a failed direct connect response', () => {
    // Scenario: the dApp asked to connect, but the wallet response said no account is connected.
    const result = directConnectionUpdateFromProviderResponse({
      origin: 'http://localhost:3012',
      request: { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      response: { jsonrpc: '2.0', id: 'connect-1', result: { isConnected: false } },
    })

    // The background should leave direct connection state unchanged.
    assert.deepEqual(result, { action: 'none' })
  })

  it('forgets an origin after a successful direct disconnect response', () => {
    // Scenario: a connected dApp explicitly disconnects through the injected provider.
    const result = directConnectionUpdateFromProviderResponse({
      origin: 'http://localhost:3012',
      request: { jsonrpc: '2.0', id: 'disconnect-1', method: 'disconnect' },
      response: { jsonrpc: '2.0', id: 'disconnect-1', result: null },
    })

    // The background should remove this origin from direct connected state.
    assert.deepEqual(result, { action: 'forget', origin: 'http://localhost:3012' })
  })
})
