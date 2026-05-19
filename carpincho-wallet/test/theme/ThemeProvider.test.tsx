import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/theme/ThemeProvider.tsx'
import { useTheme } from '@/theme/useTheme.ts'

const STORAGE_KEY = 'carpincho-theme'

const Harness = (): JSX.Element => {
  const { theme, setTheme, toggle } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button
        type="button"
        onClick={toggle}
      >
        toggle
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
      >
        force dark
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
      >
        force light
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('initialises from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark')
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )
    assert.equal(screen.getByTestId('current-theme').textContent, 'dark')
  })

  it('toggle flips theme and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )
    assert.equal(screen.getByTestId('current-theme').textContent, 'light')

    await user.click(screen.getByRole('button', { name: 'toggle' }))

    assert.equal(screen.getByTestId('current-theme').textContent, 'dark')
    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')
  })

  it('setTheme persists the explicit choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'force dark' }))

    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')

    await user.click(screen.getByRole('button', { name: 'force light' }))

    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'light')
    assert.equal(document.documentElement.dataset.theme, 'light')
  })
})
