import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { UnlockView } from '@/views/UnlockView'

const renderUnlock = (overrides: Partial<VaultContextValue> = {}): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider
        value={{ unlock: async () => undefined, ...overrides } as VaultContextValue}
      >
        <UnlockView />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('UnlockView reset vault', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows no dialog until the reset trigger is clicked', () => {
    renderUnlock()
    assert.equal(screen.queryByRole('dialog'), null)
  })

  it('opens a Radix confirm dialog instead of a native prompt', async () => {
    const user = userEvent.setup()
    renderUnlock()
    await user.click(screen.getByTestId('reset-vault-trigger'))
    const dialog = await screen.findByRole('dialog')
    assert.ok((dialog.textContent ?? '').toLowerCase().includes('reset vault'))
    assert.ok(screen.getByTestId('confirm-reset-vault'))
  })

  it('calls destroyVault when the reset is confirmed', async () => {
    const user = userEvent.setup()
    const calls: number[] = []
    renderUnlock({
      destroyVault: async () => {
        calls.push(1)
      },
    })
    await user.click(screen.getByTestId('reset-vault-trigger'))
    await user.click(await screen.findByTestId('confirm-reset-vault'))
    assert.equal(calls.length, 1)
  })

  it('does not destroy the vault when the dialog is dismissed with Escape', async () => {
    const user = userEvent.setup()
    const calls: number[] = []
    renderUnlock({
      destroyVault: async () => {
        calls.push(1)
      },
    })
    await user.click(screen.getByTestId('reset-vault-trigger'))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => {
      assert.equal(screen.queryByRole('dialog'), null)
    })
    assert.equal(calls.length, 0)
  })
})
