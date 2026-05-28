import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type {
  ConnectResult,
  JsonRpcRequest,
  JsonRpcResponse,
  JsPrepareSubmissionRequest,
  LedgerApiRequest,
  ListAccountsResult,
  Wallet,
} from '../src/types.ts'

describe('dapp-api type aliases', () => {
  it('JsPrepareSubmissionRequest accepts the minimum required shape', () => {
    const req: JsPrepareSubmissionRequest = { commands: [] }
    assert.deepEqual(req.commands, [])
  })

  it('ConnectResult requires isConnected and isNetworkConnected', () => {
    const result: ConnectResult = { isConnected: false, isNetworkConnected: true }
    assert.equal(result.isConnected, false)
    assert.equal(result.isNetworkConnected, true)
  })

  it('LedgerApiRequest carries requestMethod, resource and body', () => {
    const req: LedgerApiRequest = {
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: { parties: ['alice::fp'] },
    }
    assert.equal(req.requestMethod, 'post')
  })

  it('Wallet schema captures party identity', () => {
    const w: Wallet = {
      partyId: 'alice::fp',
      primary: true,
      status: 'allocated',
      publicKey: 'pk',
      namespace: 'ns',
      networkId: 'canton:local',
      hint: 'alice',
      signingProviderId: 'carpincho',
    }
    assert.equal(w.primary, true)
  })

  it('ListAccountsResult is an array of Wallet', () => {
    const list: ListAccountsResult = []
    assert.equal(list.length, 0)
  })

  it('JsonRpcRequest accepts string or number id', () => {
    const req1: JsonRpcRequest = { jsonrpc: '2.0', method: 'status', id: 1 }
    const req2: JsonRpcRequest = { jsonrpc: '2.0', method: 'status', id: 'abc' }
    assert.equal(req1.id, 1)
    assert.equal(req2.id, 'abc')
  })

  it('JsonRpcResponse error discriminates on the error field', () => {
    const ok: JsonRpcResponse = { jsonrpc: '2.0', id: 1, result: null }
    const err: JsonRpcResponse = { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'x' } }
    assert.ok('result' in ok)
    assert.ok('error' in err)
  })
})
