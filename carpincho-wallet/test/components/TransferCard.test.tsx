import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { TransferCard } from '@/components/TransferCard'

const INCOMING: PendingTokenTransfer = {
  contractId: 'incoming-cid-1',
  interfaceViewValue: {
    transfer: {
      sender: 'sender-party-1234567890abcdef',
      receiver: 'alice::party',
      amount: '42',
      instrumentId: { id: 'Amulet' },
      meta: { values: { 'splice.lfdecentralizedtrust.org/reason': 'invoice 42' } },
    },
  },
}

const OUTGOING: PendingTokenTransfer = {
  contractId: 'outgoing-cid-1',
  interfaceViewValue: {
    transfer: {
      sender: 'alice::party',
      receiver: 'bob-party-1234567890abcdef',
      amount: '10',
      instrumentId: { id: 'Amulet' },
    },
  },
}

describe('TransferCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders an incoming transfer with Accept, description, and a details button', async () => {
    // Scenario: an incoming transfer is the actionable case — amount, memo, Accept, and the
    // eye that opens details. Accept and the eye fire their callbacks with the transfer.
    let accepted = ''
    let opened: PendingTokenTransfer | undefined
    render(
      <TransferCard
        transfer={INCOMING}
        direction="incoming"
        onAccept={(cid) => {
          accepted = cid
        }}
        onOpenDetails={(transfer) => {
          opened = transfer
        }}
      />,
    )

    assert.equal(screen.getByText('42.00 Amulet').textContent, '42.00 Amulet')
    assert.equal(screen.getByText('invoice 42').textContent, 'invoice 42')

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    assert.equal(accepted, 'incoming-cid-1')

    await userEvent.click(screen.getByRole('button', { name: 'Transfer details' }))
    assert.equal(opened?.contractId, 'incoming-cid-1')
  })

  it('renders an outgoing transfer as watch-only with a Pending pill and no Accept', async () => {
    // Scenario: the sender can only watch their outgoing transfer settle.
    let opened: PendingTokenTransfer | undefined
    render(
      <TransferCard
        transfer={OUTGOING}
        direction="outgoing"
        onOpenDetails={(transfer) => {
          opened = transfer
        }}
      />,
    )

    assert.equal(screen.getByText('10.00 Amulet').textContent, '10.00 Amulet')
    assert.equal(screen.getByText('Pending').textContent, 'Pending')
    assert.equal(screen.queryByRole('button', { name: 'Accept' }), null)

    await userEvent.click(screen.getByRole('button', { name: 'Transfer details' }))
    assert.equal(opened?.contractId, 'outgoing-cid-1')
  })

  it('shows a busy label while accepting', () => {
    // Scenario: the Accept button reflects the in-flight state for its own transfer.
    render(
      <TransferCard
        transfer={INCOMING}
        direction="incoming"
        isAccepting
        onAccept={() => undefined}
        onOpenDetails={() => undefined}
      />,
    )

    const acceptingButton = screen.getByRole('button', { name: 'Accepting...' })
    assert.ok(acceptingButton)
    assert.ok(
      acceptingButton.hasAttribute('disabled'),
      'Accept button must be disabled while accepting',
    )
  })
})
