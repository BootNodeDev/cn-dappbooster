import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ConnectionFooter,
  type DappFooterStatus,
  type WalletServiceFooterStatus,
} from '@/components/ConnectionFooter.tsx'

const connectedService: WalletServiceFooterStatus = {
  // Wallet-service fixture representing a healthy Canton network connection.
  connected: true,
}

const disconnectedService: WalletServiceFooterStatus = {
  // Wallet-service fixture representing an unreachable service or disconnected Canton network.
  connected: false,
}

const noDapp: DappFooterStatus = {
  // Empty dApp fixture used when no page has communicated with the extension.
  kind: 'none',
}

const detectedDapp: DappFooterStatus = {
  // Detected dApp fixture matching a browser page that contacted the extension without connecting.
  kind: 'detected',
  label: 'localhost:3012',
  subtitle: 'Not connected',
  faviconUrl: 'chrome-extension://test/_favicon/?pageUrl=http%3A%2F%2Flocalhost%3A3012&size=32',
}

describe('ConnectionFooter', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows wallet-service status and opens settings from a cog button', async () => {
    // Scenario: Canton is connected, so the footer should show green service state and settings chrome.
    const user = userEvent.setup()
    let settingsCalls = 0
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={noDapp}
        onOpenSettings={() => {
          settingsCalls += 1
        }}
      />,
    )

    // The service row should use the requested copy instead of the old generic connection label.
    assert.ok(screen.getByText('canton connected'))
    assert.equal(screen.queryByText(/edit/i), null)

    // The cog button is the only settings affordance and must remain keyboard/click accessible.
    await user.click(screen.getByRole('button', { name: /connection settings/i }))
    assert.equal(settingsCalls, 1)
  })

  it('shows a red not-connected service state', () => {
    // Scenario: Canton is unavailable, so the footer should make the service problem explicit.
    render(
      <ConnectionFooter
        walletService={disconnectedService}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    // The disconnected label must be visible without opening settings.
    assert.ok(screen.getByText('canton not connected'))
  })

  it('renders dApp empty and detected states', () => {
    // Scenario: first no dApp has communicated, then a localhost page has contacted the extension.
    const { rerender } = render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    // Empty state mirrors the requested Rabby-style "No Dapp found" row.
    assert.ok(screen.getByText('No Dapp found'))

    rerender(
      <ConnectionFooter
        walletService={connectedService}
        dapp={detectedDapp}
        onOpenSettings={() => undefined}
      />,
    )

    // Detected state shows the communicating page, connection state, and favicon image.
    assert.ok(screen.getByText('localhost:3012'))
    assert.ok(screen.getByText('Not connected'))
    assert.equal(screen.getByAltText('').getAttribute('src'), detectedDapp.faviconUrl)
  })
})
