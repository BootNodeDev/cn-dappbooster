import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { ActiveContractsUtil } from '@/components/utils/ActiveContractsUtil'
import type { ActiveContract, listActiveContracts as ListFn } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const CONTRACT: ActiveContract = {
  contractId: 'cid-1',
  templateId: 'pkg:Module:Template',
  createArgument: { admin: 'alice::party' },
  createdOffset: 42,
}

const renderUtil = (listActiveContracts: typeof ListFn): void => {
  render(
    <TooltipProvider>
      <ActiveContractsUtil
        account={ACCOUNT}
        listActiveContracts={listActiveContracts}
      />
    </TooltipProvider>,
  )
}

describe('ActiveContractsUtil', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('auto-loads contracts on mount and expands the JSON on demand', async () => {
    const listActiveContracts = (async () => [CONTRACT]) as typeof ListFn
    renderUtil(listActiveContracts)

    await screen.findByText('cid-1')
    assert.ok(screen.getByRole('button', { name: /Copy contract ID/i }))

    await userEvent.click(screen.getByRole('button', { name: /toggle contract details/i }))
    await screen.findByText(/admin/)
  })

  it('passes the optional template filter to the helper on refresh', async () => {
    const calls: Parameters<typeof ListFn>[0][] = []
    const listActiveContracts = (async (params) => {
      calls.push(params)
      return [CONTRACT]
    }) as typeof ListFn
    renderUtil(listActiveContracts)

    await waitFor(() => assert.ok(calls.length >= 1))
    await userEvent.type(screen.getByLabelText('Filter template ID'), 'pkg:Module:Template')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh contracts' }))

    await waitFor(() =>
      assert.deepEqual(calls.at(-1), {
        partyId: 'alice::party',
        templateId: 'pkg:Module:Template',
      }),
    )
  })
})
