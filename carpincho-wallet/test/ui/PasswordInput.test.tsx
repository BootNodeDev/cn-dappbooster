import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordInput } from '@/components/ui/PasswordInput.tsx'

describe('PasswordInput', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders as type=password by default with a Show password toggle', () => {
    render(
      <PasswordInput
        aria-label="password"
        defaultValue="secret"
      />,
    )
    const input = screen.getByLabelText('password') as HTMLInputElement
    assert.equal(input.type, 'password')
    const toggle = screen.getByRole('button', { name: /show password/i })
    assert.equal(toggle.getAttribute('aria-pressed'), 'false')
  })

  it('toggles to type=text and updates aria-pressed when activated', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="password" />)
    const input = screen.getByLabelText('password') as HTMLInputElement
    const toggle = screen.getByRole('button', { name: /show password/i })

    await user.click(toggle)

    assert.equal(input.type, 'text')
    const hideToggle = screen.getByRole('button', { name: /hide password/i })
    assert.equal(hideToggle.getAttribute('aria-pressed'), 'true')

    await user.click(hideToggle)
    assert.equal(input.type, 'password')
  })

  it('toggle is reachable via keyboard tab navigation', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="password" />)
    const input = screen.getByLabelText('password')
    input.focus()
    await user.tab()
    const toggle = screen.getByRole('button', { name: /show password/i })
    assert.equal(document.activeElement, toggle)
  })

  it('forwards arbitrary input props', () => {
    render(
      <PasswordInput
        aria-label="password"
        placeholder="enter password"
        autoComplete="new-password"
      />,
    )
    const input = screen.getByLabelText('password') as HTMLInputElement
    assert.equal(input.placeholder, 'enter password')
    assert.equal(input.autocomplete, 'new-password')
  })

  it('sets aria-invalid when error is true', () => {
    render(
      <PasswordInput
        aria-label="password"
        error={true}
      />,
    )
    const input = screen.getByLabelText('password')
    assert.equal(input.getAttribute('aria-invalid'), 'true')
  })

  it('omits aria-invalid when error is false', () => {
    render(
      <PasswordInput
        aria-label="password"
        error={false}
      />,
    )
    const input = screen.getByLabelText('password')
    assert.equal(input.getAttribute('aria-invalid'), null)
  })
})
