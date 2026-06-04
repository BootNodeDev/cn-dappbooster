import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { useTheme } from '@/theme/useTheme'

const STORAGE_KEY = 'carpincho-theme'

const Harness = (): JSX.Element => {
  const { mode, setMode } = useTheme()
  return (
    <div>
      <span data-testid="current-mode">{mode}</span>
      <button
        type="button"
        onClick={() => setMode('dark')}
      >
        set dark
      </button>
      <button
        type="button"
        onClick={() => setMode('light')}
      >
        set light
      </button>
      <button
        type="button"
        onClick={() => setMode('system')}
      >
        set system
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

  it('defaults to system mode when nothing is stored', () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )
    assert.equal(screen.getByTestId('current-mode').textContent, 'system')
    // happy-dom reports prefers-color-scheme: dark as false, so system resolves to light.
    assert.equal(document.documentElement.dataset.theme, 'light')
  })

  it('initialises the mode from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark')
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )
    assert.equal(screen.getByTestId('current-mode').textContent, 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')
  })

  it('setMode applies and persists the explicit choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'set dark' }))
    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')

    await user.click(screen.getByRole('button', { name: 'set light' }))
    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'light')
    assert.equal(document.documentElement.dataset.theme, 'light')
  })

  it('setMode system persists the system choice and resolves the applied theme', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(STORAGE_KEY, 'dark')
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    )
    assert.equal(document.documentElement.dataset.theme, 'dark')

    await user.click(screen.getByRole('button', { name: 'set system' }))
    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'system')
    assert.equal(document.documentElement.dataset.theme, 'light')
  })
})
