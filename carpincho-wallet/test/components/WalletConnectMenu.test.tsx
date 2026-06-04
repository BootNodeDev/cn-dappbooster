import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WalletConnectMenu } from '@/components/menu/WalletConnectMenu'
import { getToastEntries, toast } from '@/components/ui/toast'

const lastToast = (): { variant: string; message: unknown } | undefined => {
  const entries = getToastEntries()
  return entries.length === 0 ? undefined : entries[entries.length - 1]
}

describe('WalletConnectMenu', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('disables Connect until a URI is entered, then enables it', async () => {
    render(<WalletConnectMenu onPaired={() => undefined} />)

    const button = screen.getByRole('button', { name: 'Connect' })
    assert.equal((button as HTMLButtonElement).disabled, true)

    await userEvent.type(screen.getByPlaceholderText('wc:...'), 'wc:test@2')
    assert.equal((button as HTMLButtonElement).disabled, false)
  })

  it('exposes Connect as a submit button so Enter submits the form', () => {
    render(<WalletConnectMenu onPaired={() => undefined} />)
    const button = screen.getByRole('button', { name: 'Connect' })
    assert.equal(button.getAttribute('type'), 'submit')
    assert.ok(button.closest('form'), 'Connect button is inside a form')
  })

  it('warns and does not pair when submitted with an empty URI', () => {
    let paired = 0
    render(<WalletConnectMenu onPaired={() => (paired += 1)} />)

    const form = screen.getByPlaceholderText('wc:...').closest('form')
    assert.ok(form)
    fireEvent.submit(form as HTMLFormElement)

    assert.equal(lastToast()?.variant, 'warning')
    assert.equal(paired, 0)
  })
})
