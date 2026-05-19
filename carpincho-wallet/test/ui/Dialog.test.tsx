import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import * as Dialog from '@radix-ui/react-dialog'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const DialogHarness = (): JSX.Element => (
  <Dialog.Root>
    <Dialog.Trigger asChild>
      <button type="button">Open settings</button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay data-testid="dialog-overlay" />
      <Dialog.Content>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>Configure your wallet.</Dialog.Description>
        <input
          aria-label="rpc-url"
          type="text"
        />
        <Dialog.Close asChild>
          <button type="button">Close</button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
)

describe('Dialog (Radix)', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens on trigger click and exposes role=dialog with a labelled title', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: /open settings/i })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog')
    assert.ok(dialog)
    const titleId = dialog.getAttribute('aria-labelledby')
    assert.ok(titleId)
    const title = document.getElementById(titleId ?? '')
    assert.equal(title?.textContent, 'Settings')
  })

  it('moves focus into the dialog when opened', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: /open settings/i })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')

    assert.ok(dialog.contains(document.activeElement), 'focus should be inside the dialog')
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: /open settings/i })
    await user.click(trigger)
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')

    assert.equal(screen.queryByRole('dialog'), null)
    assert.equal(document.activeElement, trigger)
  })

  it('closes when the Close button is activated', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: /open settings/i })
    await user.click(trigger)
    await screen.findByRole('dialog')

    const closeBtn = screen.getByRole('button', { name: /^close$/i })
    await user.click(closeBtn)

    assert.equal(screen.queryByRole('dialog'), null)
    assert.equal(document.activeElement, trigger)
  })

  it('closes when the overlay is clicked', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: /open settings/i })
    await user.click(trigger)
    await screen.findByRole('dialog')

    const overlay = screen.getByTestId('dialog-overlay')
    await user.click(overlay)

    assert.equal(screen.queryByRole('dialog'), null)
    assert.equal(document.activeElement, trigger)
  })
})
