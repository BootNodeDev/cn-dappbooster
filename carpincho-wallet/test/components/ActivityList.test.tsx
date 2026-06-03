import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityList } from '@/components/ActivityList'
import type { TransactionRecord } from '@/vault/types'

const baseTransaction: TransactionRecord = {
  // Vault record written after Canton accepts an execution; the command carries the inspectable values.
  id: 'tx-1',
  accountId: 'account-1',
  accountName: 'Primary',
  partyId: 'primary::namespace',
  network: 'canton:local',
  method: 'prepareExecuteAndWait',
  status: 'executed',
  createdAt: 1_700_000_000_000,
  preparedTransactionHash: 'prepared-hash',
  commandCount: 1,
  summary: 'ExerciseCommand',
}

describe('ActivityList', () => {
  afterEach(() => {
    // Each render owns document state, so cleanup leaves the next scenario with an empty DOM.
    cleanup()
  })

  it('shows an empty message when there is no activity', () => {
    // Scenario: a fresh account has executed nothing, so the tab states the empty condition plainly.
    render(<ActivityList transactions={[]} />)
    assert.ok(screen.getByText('No activity yet'))
  })

  it('opens a detail popup with the stored command payload when a row is clicked', async () => {
    // Scenario: a dApp executed one DAML choice and the user opens the row to inspect the command.
    const user = userEvent.setup()
    const transaction: TransactionRecord = {
      ...baseTransaction,
      preparedTransaction: 'prepared-base64',
      commands: [
        {
          ExerciseCommand: {
            templateId: 'Counter:Counter',
            contractId: 'contract-1',
            choice: 'Increment',
            choiceArgument: { by: 1 },
          },
        },
      ],
    }

    // The collapsed row shows the summary as its title; clicking it opens the detail popup.
    render(<ActivityList transactions={[transaction]} />)
    await user.click(screen.getByText('ExerciseCommand'))

    // The popup exposes the original command JSON so the user can inspect the called choice and values.
    assert.ok(screen.getByText('Command payload'))
    assert.match(screen.getByText(/"choice": "Increment"/).textContent ?? '', /"by": 1/)
  })

  it('shows the normalized wallet API method in the detail popup', async () => {
    // Scenario: a transaction recorded the internal prepare-and-execute method, but Activity shows the public name.
    const user = userEvent.setup()
    render(<ActivityList transactions={[baseTransaction]} />)
    await user.click(screen.getByText('ExerciseCommand'))

    // The detail view avoids leaking the internal prepare step; users recognize the execution as executeAndWait.
    assert.equal(screen.queryByText('prepareExecuteAndWait'), null)
    assert.ok(screen.getByText('executeAndWait'))
  })
})
