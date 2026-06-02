import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityList } from '@/components/ActivityList.tsx'
import type { TransactionRecord } from '@/vault/types.ts'

describe('ActivityList', () => {
  // Scenario group: executed Canton transactions should expose the original dApp command payload.
  afterEach(() => {
    // Each render owns document state, so cleanup leaves the next scenario with an empty DOM.
    cleanup()
  })

  it('shows the stored command payload when a transaction detail is opened', async () => {
    // Scenario: a dApp executed one DAML choice and the wallet stored both the human-facing command and prepared transaction bytes.
    const user = userEvent.setup()

    // This transaction fixture represents the vault record written after Canton accepts an execution.
    // The command contains the domain values the user needs to inspect later from Activity.
    const transaction: TransactionRecord = {
      id: 'tx-1',
      accountId: 'account-1',
      accountName: 'Primary',
      partyId: 'primary::namespace',
      network: 'canton:local',
      method: 'prepareExecuteAndWait',
      status: 'executed',
      createdAt: 1_700_000_000_000,
      preparedTransaction: 'prepared-base64',
      preparedTransactionHash: 'prepared-hash',
      commandCount: 1,
      summary: 'ExerciseCommand',
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

    // Rendering the activity list should keep the row compact until the user opens the detail.
    render(<ActivityList transactions={[transaction]} />)
    await user.click(screen.getByText('open'))

    // The detail view should expose the original command JSON so the user can inspect the called choice and values.
    assert.ok(screen.getByText('Command payload'))
    assert.match(screen.getByText(/"choice": "Increment"/).textContent ?? '', /"by": 1/)
  })
})
