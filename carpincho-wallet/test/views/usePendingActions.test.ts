import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { getToastEntries, toast } from '@/components/ui/toast'
import {
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
} from '@/provider/methods'
import type { ProviderResponder } from '@/provider/types'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types'
import { usePendingActions } from '@/views/home/usePendingActions'

const originalFetch = globalThis.fetch

const account = (overrides: Partial<AccountPublic> = {}): AccountPublic =>
  ({
    id: 'acc-1',
    name: 'bn-dev',
    partyId: 'bn-dev::1220abcd',
    network: 'canton:local',
    ...overrides,
  }) as unknown as AccountPublic

// Captures responder.result / responder.error calls for assertions.
const makeResponder = (): {
  responder: ProviderResponder
  results: unknown[]
  errors: Array<{ code: number; message: string }>
} => {
  const results: unknown[] = []
  const errors: Array<{ code: number; message: string }> = []
  return {
    results,
    errors,
    responder: {
      result: async (value) => {
        results.push(value)
      },
      error: async (code, message) => {
        errors.push({ code, message })
      },
    },
  }
}

// Records the state setters / lifecycle callbacks the hook drives so each test can assert them.
interface Spies {
  proposalSet: Array<unknown>
  signSet: Array<unknown>
  executeSet: Array<unknown>
  busy: boolean[]
  refreshed: number
  popupClosed: number
}

const makeArgs = (
  overrides: Partial<Parameters<typeof usePendingActions>[0]>,
): { args: Parameters<typeof usePendingActions>[0]; spies: Spies } => {
  const spies: Spies = {
    proposalSet: [],
    signSet: [],
    executeSet: [],
    busy: [],
    refreshed: 0,
    popupClosed: 0,
  }
  const args: Parameters<typeof usePendingActions>[0] = {
    vault: {
      accounts: [account()],
      signMessage: async () => 'signature-xyz',
      recordTransaction: async () => undefined,
    } as unknown as VaultContextValue,
    proposal: undefined,
    proposalAccount: null,
    pendingSign: undefined,
    pendingExecute: undefined,
    setProposal: (v) => spies.proposalSet.push(v),
    setPendingSign: (v) => spies.signSet.push(v),
    setPendingExecute: (v) => spies.executeSet.push(v),
    setBusy: (v) => spies.busy.push(v as boolean),
    refreshSessions: async () => {
      spies.refreshed += 1
    },
    closeExtensionPopup: () => {
      spies.popupClosed += 1
    },
    ...overrides,
  }
  return { args, spies }
}

const lastToast = (): { variant: string; message: unknown } | undefined => {
  const entries = getToastEntries()
  return entries.length === 0 ? undefined : entries[entries.length - 1]
}

// Routes wallet-service JSON-RPC calls by method name to canned results (or a JSON-RPC error).
const installWalletService = (
  handlers: Record<string, { result?: unknown; error?: { code: number; message: string } }>,
): void => {
  globalThis.fetch = (async (_input: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as { method: string }
    const handler = handlers[body.method]
    if (handler === undefined) {
      throw new Error(`unexpected wallet-service method: ${body.method}`)
    }
    const payload =
      handler.error !== undefined ? { error: handler.error } : { result: handler.result }
    return new Response(JSON.stringify(payload), { status: 200 })
  }) as typeof globalThis.fetch
}

describe('usePendingActions', () => {
  beforeEach(() => {
    toast.clear()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    toast.clear()
  })

  describe('sign', () => {
    const signRequest = (responder: ProviderResponder): PendingSignRequest => ({
      account: account(),
      messageBase64: 'bWVzc2FnZQ==',
      responder,
    })

    it('approves a sign request: signs, responds, toasts, and clears it', async () => {
      const { responder, results } = makeResponder()
      const { args, spies } = makeArgs({ pendingSign: signRequest(responder) })

      await usePendingActions(args).onApproveSign()

      assert.deepEqual(results, [{ signature: 'signature-xyz' }])
      assert.equal(lastToast()?.variant, 'success')
      assert.deepEqual(spies.signSet, [undefined])
      assert.deepEqual(spies.busy, [true, false])
      assert.equal(spies.popupClosed, 1)
    })

    it('reports a sign failure to both the dApp and the user', async () => {
      const { responder, results, errors } = makeResponder()
      const { args, spies } = makeArgs({
        pendingSign: signRequest(responder),
        vault: {
          accounts: [account()],
          signMessage: async () => {
            throw new Error('key locked')
          },
          recordTransaction: async () => undefined,
        } as unknown as VaultContextValue,
      })

      await usePendingActions(args).onApproveSign()

      assert.deepEqual(results, [])
      assert.deepEqual(errors, [{ code: -32000, message: 'key locked' }])
      assert.equal(lastToast()?.variant, 'error')
      assert.deepEqual(spies.signSet, [undefined])
    })

    it('is a no-op when there is no pending sign request', async () => {
      const { args, spies } = makeArgs({ pendingSign: undefined })
      await usePendingActions(args).onApproveSign()
      assert.deepEqual(spies.busy, [])
      assert.equal(lastToast(), undefined)
    })

    it('rejects a sign request with the 4001 user-rejected error', async () => {
      const { responder, errors } = makeResponder()
      const { args, spies } = makeArgs({ pendingSign: signRequest(responder) })

      await usePendingActions(args).onRejectSign()

      assert.deepEqual(errors, [{ code: 4001, message: 'user rejected' }])
      assert.deepEqual(spies.signSet, [undefined])
      assert.equal(spies.popupClosed, 1)
    })
  })

  describe('execute', () => {
    const executeRequest = (
      responder: ProviderResponder,
      method: PendingExecuteRequest['method'] = CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
      rawMethod = 'prepareExecuteAndWait',
    ): PendingExecuteRequest => ({
      account: account(),
      method,
      rawMethod,
      params: { commandId: 'cmd-1', submissionId: 'sub-1', commands: [{ Create: {} }] },
      responder,
    })

    it('runs the prepare → sign → execute → record pipeline and responds with the tx', async () => {
      installWalletService({
        prepareTransaction: {
          result: {
            preparedTransaction: 'ptx',
            preparedTransactionHash: 'hash-1',
            hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
          },
        },
        executePrepared: { result: { updateId: 'update-1', completionOffset: 7 } },
      })
      const { responder, results } = makeResponder()
      const recorded: unknown[] = []
      const { args, spies } = makeArgs({
        pendingExecute: executeRequest(responder),
        vault: {
          accounts: [account()],
          signMessage: async () => 'signature-xyz',
          recordTransaction: async (tx: unknown) => {
            recorded.push(tx)
          },
        } as unknown as VaultContextValue,
      })

      await usePendingActions(args).onApproveExecute()

      assert.equal(recorded.length, 1)
      assert.deepEqual(results, [
        {
          tx: {
            status: 'executed',
            commandId: 'cmd-1',
            payload: { updateId: 'update-1', completionOffset: 7 },
          },
        },
      ])
      assert.equal(lastToast()?.variant, 'success')
      assert.deepEqual(spies.executeSet, [undefined])
      assert.deepEqual(spies.busy, [true, false])
      assert.equal(spies.popupClosed, 1)
    })

    it('responds with null for the prepareExecute (no-wait) method', async () => {
      installWalletService({
        prepareTransaction: {
          result: {
            preparedTransaction: 'ptx',
            preparedTransactionHash: 'hash-1',
            hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
          },
        },
        executePrepared: { result: { updateId: 'update-1', completionOffset: 7 } },
      })
      const { responder, results } = makeResponder()
      const { args } = makeArgs({
        pendingExecute: executeRequest(responder, CANTON_METHOD_PREPARE_EXECUTE, 'prepareExecute'),
      })

      await usePendingActions(args).onApproveExecute()

      assert.deepEqual(results, [null])
    })

    it('surfaces a prepare failure to the dApp and the user', async () => {
      installWalletService({
        prepareTransaction: { error: { code: -32000, message: 'participant down' } },
      })
      const { responder, results, errors } = makeResponder()
      const { args, spies } = makeArgs({ pendingExecute: executeRequest(responder) })

      await usePendingActions(args).onApproveExecute()

      assert.deepEqual(results, [])
      assert.equal(errors.length, 1)
      assert.equal(errors[0].code, -32000)
      assert.match(errors[0].message, /participant down/)
      assert.equal(lastToast()?.variant, 'error')
      assert.deepEqual(spies.executeSet, [undefined])
    })

    it('rejects an execute request with the 4001 user-rejected error', async () => {
      const { responder, errors } = makeResponder()
      const { args, spies } = makeArgs({ pendingExecute: executeRequest(responder) })

      await usePendingActions(args).onRejectExecute()

      assert.deepEqual(errors, [{ code: 4001, message: 'user rejected' }])
      assert.deepEqual(spies.executeSet, [undefined])
      assert.equal(spies.popupClosed, 1)
    })
  })

  describe('proposal', () => {
    it('is a no-op when there is no proposal', async () => {
      const { args, spies } = makeArgs({ proposal: undefined })
      await usePendingActions(args).onApproveProposal()
      assert.deepEqual(spies.busy, [])
      assert.equal(lastToast(), undefined)
    })

    it('errors when the chosen proposal account does not exist', async () => {
      const { args, spies } = makeArgs({
        proposal: { id: 'prop-1' } as unknown as Parameters<
          typeof usePendingActions
        >[0]['proposal'],
        proposalAccount: 'missing-account',
        vault: {
          accounts: [account()],
          signMessage: async () => 'signature-xyz',
          recordTransaction: async () => undefined,
        } as unknown as VaultContextValue,
      })

      await usePendingActions(args).onApproveProposal()

      assert.equal(lastToast()?.variant, 'error')
      // Bailed before flipping busy or clearing the proposal.
      assert.deepEqual(spies.busy, [])
      assert.deepEqual(spies.proposalSet, [])
    })
  })
})
