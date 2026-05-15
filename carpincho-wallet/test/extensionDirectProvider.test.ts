import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDirectProviderResponse } from '../src/extension/directProvider.ts'
import type { AccountPublic } from '../src/vault/types.ts'

const account: AccountPublic = {
  id: 'account-1',
  name: 'Primary',
  partyId: 'primary::namespace',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1
}

describe('extension direct provider handling', () => {
  it('responds to connect without queuing when the wallet is unlocked', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      { accounts: [account], primary: account }
    )

    assert.equal(response?.id, 'connect-1')
    const result = response?.result as { isConnected?: boolean }
    assert.equal(result.isConnected, true)
  })

  it('leaves connect queued when there is no unlocked wallet snapshot', async () => {
    const response = await createDirectProviderResponse(
      { jsonrpc: '2.0', id: 'connect-1', method: 'connect' },
      null
    )

    assert.equal(response, undefined)
  })

  it('leaves signing requests queued for user approval', async () => {
    const response = await createDirectProviderResponse(
      {
        jsonrpc: '2.0',
        id: 'tx-1',
        method: 'prepareExecuteAndWait',
        params: { commands: [] }
      },
      { accounts: [account], primary: account }
    )

    assert.equal(response, undefined)
  })
})
