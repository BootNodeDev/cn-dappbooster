import { strict as assert } from 'node:assert'
import * as http from 'node:http'
import { describe, it } from 'node:test'
import { createRpc, errorData, errorMessage } from '../src/rpc.ts'
import type { JsonRpcResponse } from '../src/types.ts'

const baseConfig = () => ({
  port: 3010,
  corsOrigins: ['http://localhost:3011'],
  network: 'canton:local',
  accountsHintPrefix: undefined as string | undefined,
  provider: {
    id: 'wallet-service',
    version: '0.1.0',
    url: 'http://localhost:3010',
    userUrl: 'http://localhost:3010',
  },
  canton: {
    jsonApiUrl: 'http://localhost:3013',
    ledgerApiUrl: 'grpc://localhost:3014',
    adminApiUrl: 'grpc://localhost:3015',
    scanUrl: 'http://localhost:4000',
    scanHost: 'scan.localhost',
    backendUserId: 'wallet-service',
    backendToken: undefined as string | undefined,
    tokenSource: 'none' as const,
  },
})

describe('rpc dispatcher', () => {
  it('returns -32600 when jsonrpc is not "2.0"', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '1.0' as never,
      id: 1,
      method: 'status',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32600)
  })

  it('returns -32600 when method is not a string', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 42 as never,
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32600)
  })

  it('returns -32601 for unknown methods', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'doesNotExist',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })

  it('returns -32004 for prepareExecute (carpincho signs)', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareExecute',
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32004)
  })

  describe('listAccounts (CanActAs rights)', () => {
    it('errors when no backend token is configured', async () => {
      const rpc = createRpc(baseConfig())
      const res = (await rpc.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'listAccounts',
      })) as JsonRpcResponse
      assert.ok('error' in res)
      assert.equal(res.error.code, -32000)
    })

    it('maps the user CanActAs rights to accounts', async () => {
      const config = baseConfig()
      config.canton.backendToken = 'test-token'
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            rights: [
              { kind: { CanActAs: { value: { party: 'vesting-pablo-123::1220abc' } } } },
              { kind: { ParticipantAdmin: {} } },
              { kind: { CanActAs: { value: { party: 'vesting-operator-123::1220def' } } } },
            ],
          }),
        headers: { get: (_: string) => 'application/json' },
      })) as unknown as typeof fetch
      try {
        const rpc = createRpc(config)
        const res = (await rpc.handle({
          jsonrpc: '2.0',
          id: 1,
          method: 'listAccounts',
        })) as JsonRpcResponse
        assert.ok('result' in res)
        const accounts = res.result as Array<{ partyId: string; hint: string }>
        assert.equal(accounts.length, 2)
        assert.deepEqual(
          accounts.map((a) => a.partyId),
          ['vesting-pablo-123::1220abc', 'vesting-operator-123::1220def'],
        )
        assert.equal(accounts[0]?.hint, 'vesting-pablo-123')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('hits the correct URL and sends Authorization: Bearer <token>', async () => {
      const config = baseConfig()
      config.canton.backendToken = 'my-secret-token'
      config.canton.backendUserId = 'vesting-service'
      const originalFetch = globalThis.fetch
      let capturedUrl: string | undefined
      let capturedAuth: string | undefined
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input)
        capturedAuth = (init?.headers as Record<string, string>)?.authorization
        return {
          ok: true,
          text: async () => JSON.stringify({ rights: [] }),
          headers: { get: (_: string) => 'application/json' },
        }
      }) as unknown as typeof fetch
      try {
        const rpc = createRpc(config)
        await rpc.handle({ jsonrpc: '2.0', id: 1, method: 'listAccounts' })
        assert.ok(
          capturedUrl?.endsWith('/v2/users/vesting-service/rights'),
          `expected URL ending with /v2/users/vesting-service/rights, got: ${capturedUrl}`,
        )
        assert.equal(capturedAuth, 'Bearer my-secret-token')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('returns empty accounts and does not throw when the 200 body is non-JSON', async () => {
      const config = baseConfig()
      config.canton.backendToken = 'test-token'
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => ({
        ok: true,
        text: async () => 'unexpected plain text from server',
        headers: { get: (_: string) => 'text/html' },
      })) as unknown as typeof fetch
      try {
        const rpc = createRpc(config)
        const res = (await rpc.handle({
          jsonrpc: '2.0',
          id: 1,
          method: 'listAccounts',
        })) as JsonRpcResponse
        assert.ok('result' in res, 'expected result, got error')
        assert.deepEqual(res.result, [])
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('filters accounts by accountsHintPrefix when configured', async () => {
      const config = baseConfig()
      config.canton.backendToken = 'test-token'
      config.accountsHintPrefix = 'vesting-'
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            rights: [
              { kind: { CanActAs: { value: { party: 'vesting-pablo-1::1220a' } } } },
              { kind: { CanActAs: { value: { party: 'spike-owner-9::1220z' } } } },
            ],
          }),
        headers: { get: (_: string) => 'application/json' },
      })) as unknown as typeof fetch
      try {
        const rpc = createRpc(config)
        const res = (await rpc.handle({
          jsonrpc: '2.0',
          id: 1,
          method: 'listAccounts',
        })) as JsonRpcResponse
        assert.ok('result' in res)
        const accounts = res.result as Array<{ partyId: string }>
        assert.deepEqual(
          accounts.map((account) => account.partyId),
          ['vesting-pablo-1::1220a'],
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  it('getActiveNetwork returns the configured network', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'getActiveNetwork',
    })) as JsonRpcResponse
    assert.ok('result' in res)
    assert.deepEqual(res.result, { networkId: 'canton:local' })
  })
})

describe('JSON-RPC notifications', () => {
  it('returns undefined for a notification (no id field)', async () => {
    const rpc = createRpc(baseConfig())
    const res = await rpc.handle({ jsonrpc: '2.0', method: 'disconnect' } as never)
    assert.equal(res, undefined)
  })

  it('returns a response for id: null (explicit, not a notification)', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: null,
      method: 'disconnect',
    })) as JsonRpcResponse
    assert.ok(res !== undefined)
    assert.ok('result' in res)
  })
})

describe('invalid params mapping', () => {
  it('returns -32602 when prepareTransaction is missing commands', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareTransaction',
      params: { partyId: 'alice::fp' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })

  it('returns -32602 when ledgerApi is missing resource', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'ledgerApi',
      params: { requestMethod: 'get' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })
})

describe('party methods are off the dapp-api surface', () => {
  it('prepareCreateParty returns -32601 Method not found', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'prepareCreateParty',
      params: { publicKeyBase64: 'pk', partyHint: 'alice' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })

  it('completeCreateParty returns -32601 Method not found', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'completeCreateParty',
      params: { onboardingId: 'x', signatureBase64: 'sig' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32601)
  })
})

describe('scanApi pass-through', () => {
  it('forwards to scanUrl + resource with Host header and returns parsed body', async () => {
    const responseBody = { rounds: [{ number: 1 }] }
    let capturedHost: string | undefined
    let capturedAuth: string | undefined

    const server = http.createServer((req, res) => {
      capturedHost = req.headers.host
      capturedAuth = req.headers.authorization
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(responseBody))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as { port: number }

    const config = baseConfig()
    config.canton.scanUrl = `http://127.0.0.1:${port}`

    try {
      const rpc = createRpc(config)
      const res = (await rpc.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'scanApi',
        params: { resource: '/v0/domains/global-domain/rounds/open', requestMethod: 'get' },
      })) as JsonRpcResponse
      assert.ok('result' in res, `expected result, got: ${JSON.stringify(res)}`)
      assert.deepEqual(res.result, responseBody)
      assert.equal(capturedHost, 'scan.localhost')
      assert.equal(capturedAuth, undefined)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })

  it('returns -32602 when resource is missing', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'scanApi',
      params: { requestMethod: 'get' },
    })) as JsonRpcResponse
    assert.ok('error' in res)
    assert.equal(res.error.code, -32602)
  })
})

describe('ledgerApi pass-through', () => {
  it('accepts requestMethod=get', async () => {
    const rpc = createRpc(baseConfig())
    const res = (await rpc.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'ledgerApi',
      params: { requestMethod: 'get', resource: '/v2/version' },
    })) as JsonRpcResponse
    // Without a backend token + real SDK this fails at our token check, not at whitelist validation.
    // Assert: error is NOT -32602 (validation) and NOT a whitelist rejection.
    assert.ok('error' in res)
    assert.notEqual(res.error.code, -32602)
    assert.ok(!String(res.error.message).includes('Only POST'))
  })
})

describe('error serialization', () => {
  // SDK rejections are plain JsCantonError objects, not Error instances.
  const cantonError = {
    code: 'LEDGER_API_INTERNAL_ERROR',
    cause: 'Expected ujson.Arr (data: {"map":[]})',
    errorCategory: 4,
    correlationId: 'abc123',
  }

  it('errorMessage surfaces code and cause from a JsCantonError-shaped object', () => {
    assert.equal(
      errorMessage(cantonError),
      'LEDGER_API_INTERNAL_ERROR: Expected ujson.Arr (data: {"map":[]})',
    )
  })

  it('errorMessage keeps Error messages as-is', () => {
    assert.equal(errorMessage(new Error('boom')), 'boom')
  })

  it('errorMessage passes strings through', () => {
    assert.equal(errorMessage('plain failure'), 'plain failure')
  })

  it('errorMessage serializes other objects as JSON instead of "[object Object]"', () => {
    assert.equal(errorMessage({ reason: 'no' }), '{"reason":"no"}')
  })

  it('errorMessage falls back to String() for unserializable objects', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    assert.equal(errorMessage(circular), '[object Object]')
  })

  it('errorData passes a plain-object rejection through as data', () => {
    assert.deepEqual(errorData(cantonError), cantonError)
  })

  it('errorData wraps primitives in { raw }', () => {
    assert.deepEqual(errorData('boom'), { raw: 'boom' })
  })

  it('errorData keeps name and message for Error instances', () => {
    const data = errorData(new Error('boom'))
    assert.equal(data.name, 'Error')
    assert.equal(data.message, 'boom')
  })
})
