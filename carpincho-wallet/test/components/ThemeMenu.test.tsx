import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeMenu } from '@/components/menu/ThemeMenu.tsx'
import { ThemeProvider } from '@/theme/ThemeProvider.tsx'

const STORAGE_KEY = 'carpincho-theme'

describe('ThemeMenu', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('renders the three modes and marks system active by default', () => {
    render(
      <ThemeProvider>
        <ThemeMenu />
      </ThemeProvider>,
    )
    for (const label of [/^light$/i, /^dark$/i, /^system$/i]) {
      assert.ok(screen.getByRole('button', { name: label }))
    }
    assert.equal(
      screen.getByRole('button', { name: /^system$/i }).getAttribute('aria-current'),
      'true',
    )
  })

  it('selecting a mode moves the active marker and persists the choice', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeMenu />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: /^dark$/i }))
    assert.equal(
      screen.getByRole('button', { name: /^dark$/i }).getAttribute('aria-current'),
      'true',
    )
    assert.equal(
      screen.getByRole('button', { name: /^system$/i }).getAttribute('aria-current'),
      null,
    )
    assert.equal(window.localStorage.getItem(STORAGE_KEY), 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')
  })
})
