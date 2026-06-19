import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { CreateFirstAccount } from '@/views/onboarding/CreateFirstAccount'

const vaultStub = { addAccount: async () => undefined } as unknown as VaultContextValue

const renderStep = (): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={vaultStub}>
        <CreateFirstAccount />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateFirstAccount', () => {
  afterEach(() => cleanup())

  it('renders only the account form', () => {
    renderStep()
    assert.ok(screen.getByTestId('add-account-hint-input'))
  })

  it('does not render the connection footer or its settings control', () => {
    renderStep()
    assert.equal(screen.queryByRole('button', { name: 'Connection settings' }), null)
  })
})
