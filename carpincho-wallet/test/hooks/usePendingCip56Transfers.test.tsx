import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CIP56_TRANSFER_POLL_MS,
  type Cip56TransferApi,
  usePendingCip56Transfers,
} from '@/hooks/usePendingCip56Transfers'
import type { AccountPublic } from '@/vault/types'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the selected party whose incoming token transfers are polled.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const Probe = ({ api }: { api: Cip56TransferApi }): JSX.Element => {
  const state = usePendingCip56Transfers(ACCOUNT, {
    api,
    pollMs: null,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
  })
  return (
    <div>
      <output>{state.transfers.map((transfer) => transfer.contractId).join(',')}</output>
      <span>{state.error ?? 'no-error'}</span>
      <button
        type="button"
        onClick={() => {
          void state.accept('transfer-cid-1')
        }}
      >
        Accept
      </button>
    </div>
  )
}

describe('usePendingCip56Transfers', () => {
  afterEach(() => {
    // Each test mounts a hook probe with its own fake API state.
    cleanup()
  })

  it('uses a five-second polling interval by default', () => {
    // Scenario: pending transfer acceptance has no browser websocket, so the
    // hook must poll often enough for the popup to update without manual refresh.
    assert.equal(CIP56_TRANSFER_POLL_MS, 5_000)
  })

  it('loads pending transfers immediately and refreshes after accept', async () => {
    // Scenario: opening the token actions view should show the current pending transfer
    // list, then accepting one should ask the API to accept and refresh the list.
    const calls: string[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => {
        calls.push('list')
        return calls.includes('accept') ? [] : [{ contractId: 'transfer-cid-1' }]
      },
      acceptTransfer: async ({ account, transferInstructionCid }) => {
        calls.push('accept')
        assert.equal(account.id, 'account-1')
        assert.equal(transferInstructionCid, 'transfer-cid-1')
        return { updateId: 'update-1' }
      },
    }

    render(<Probe api={api} />)

    await waitFor(() =>
      assert.equal(screen.getByText('transfer-cid-1').textContent, 'transfer-cid-1'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.equal(screen.getByRole('status').textContent, ''))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
  })
})
