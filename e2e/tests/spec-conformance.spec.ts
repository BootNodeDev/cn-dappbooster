// Conformance tests for the wallet-service `/rpc` surface — locks invariants
// that the dapp-api spec implies but doesn't write down.
//
// In particular: ledgerApi is a TRANSPARENT proxy to the participant's JSON API.
// The dApp is responsible for sending participant-native body shapes. The wallet
// must NOT translate request bodies, and MUST return the raw participant
// response (not a `{response, status}` or `{contracts}` wrapper).
//
// This test exists because an earlier version of wallet-service had a
// compatibility shim that translated `{parties, templateIds, filterByParty}`
// into the participant-native `{filter, activeAtOffset, ...}` shape and wrapped
// the response in `{contracts}`. That shim was removed once the canonical
// wallet-gateway-remote behavior (pure pass-through) was verified upstream.
// If anyone reintroduces a translator, these tests should fail.

import { expect, test, WALLET_SERVICE_URL } from '../fixtures/stack.ts'

const rpc = async (
  request: import('@playwright/test').APIRequestContext,
  method: string,
  params?: unknown,
): Promise<{
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}> => {
  const response = await request.post(`${WALLET_SERVICE_URL}/rpc`, {
    data: { jsonrpc: '2.0', id: 1, method, params },
  })
  expect(response.ok()).toBe(true)
  return await response.json()
}

test.describe('/rpc spec conformance', () => {
  test('ledgerApi returns the raw participant response for GET /v2/state/ledger-end', async ({
    request,
  }) => {
    const body = await rpc(request, 'ledgerApi', {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })
    expect(body.error).toBeUndefined()
    const result = body.result as Record<string, unknown>
    expect(result).toHaveProperty('offset')
    expect(typeof result.offset).toBe('number')
    // Anti-regression: must NOT be wrapped in {response, status} or similar.
    expect(result).not.toHaveProperty('response')
    expect(result).not.toHaveProperty('status')
  })

  test('ledgerApi rejects participant-rejected bodies with -32000 (no silent translation)', async ({
    request,
  }) => {
    // Sending the SDK-friendly shape that the OLD shim used to translate.
    // Without the shim, Canton will reject it (missing required `activeAtOffset`)
    // and the wallet propagates the error rather than rewriting the body.
    const body = await rpc(request, 'ledgerApi', {
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: { parties: ['some-party'], templateIds: [], filterByParty: true },
    })
    expect(body.error).toBeDefined()
    expect(body.error?.code).toBe(-32000)
    expect(body.error?.message).toContain('400')
  })

  test('ledgerApi accepts participant-native ACS body and returns the raw array', async ({
    request,
  }) => {
    // Get the offset first (also exercises GET pass-through).
    const offsetBody = await rpc(request, 'ledgerApi', {
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })
    const offset = (offsetBody.result as { offset: number }).offset

    // Query parties known to exist on a fresh participant: `participant1` is
    // always present once the participant has booted, so this test doesn't
    // depend on whether any user parties were onboarded by earlier tests.
    const partiesBody = await rpc(request, 'ledgerApi', {
      requestMethod: 'get',
      resource: '/v2/parties',
    })
    const parties = (partiesBody.result as { partyDetails: Array<{ party: string }> }).partyDetails
    expect(parties.length).toBeGreaterThan(0)
    const probeParty = parties[0]!.party

    const body = await rpc(request, 'ledgerApi', {
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: {
          filtersByParty: {
            [probeParty]: {
              cumulative: [
                {
                  identifierFilter: {
                    WildcardFilter: {
                      value: { includeCreatedEventBlob: true },
                    },
                  },
                },
              ],
            },
          },
        },
        activeAtOffset: offset,
        verbose: true,
      },
    })

    expect(body.error).toBeUndefined()
    expect(Array.isArray(body.result)).toBe(true)
    // Anti-regression: must NOT be wrapped.
    expect(body.result).not.toMatchObject({ contracts: expect.anything() })
    expect(body.result).not.toMatchObject({ response: expect.anything() })
  })

  test('removed-from-dapp-api: prepareCreateParty and completeCreateParty return -32601', async ({
    request,
  }) => {
    for (const method of ['prepareCreateParty', 'completeCreateParty']) {
      const body = await rpc(request, method, {})
      expect(body.error?.code).toBe(-32601)
    }
  })

  test('reserved-for-future: prepareExecute, prepareExecuteAndWait, signMessage return -32004', async ({
    request,
  }) => {
    for (const method of ['prepareExecute', 'prepareExecuteAndWait', 'signMessage']) {
      const body = await rpc(request, method)
      expect(body.error?.code).toBe(-32004)
    }
  })
})
