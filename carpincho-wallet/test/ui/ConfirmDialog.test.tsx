import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders title and description and fires onConfirm on the action button', async () => {
    const user = userEvent.setup()
    let confirmed = false
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Remove account?"
        description="alice will be removed."
        confirmLabel="Remove"
        onConfirm={() => {
          confirmed = true
        }}
      />,
    )

    const dialog = await screen.findByRole('alertdialog')
    assert.ok((dialog.textContent ?? '').includes('Remove account?'))
    assert.ok((dialog.textContent ?? '').includes('alice will be removed.'))

    await user.click(screen.getByTestId('confirm-remove-action'))
    assert.equal(confirmed, true)
  })

  it('requests close via the cancel button without confirming', async () => {
    const user = userEvent.setup()
    let confirmed = false
    const opens: boolean[] = []
    render(
      <ConfirmDialog
        open
        onOpenChange={(next) => opens.push(next)}
        title="Remove account?"
        description="alice will be removed."
        confirmLabel="Remove"
        onConfirm={() => {
          confirmed = true
        }}
      />,
    )

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    assert.equal(confirmed, false)
    assert.ok(opens.includes(false))
  })
})
