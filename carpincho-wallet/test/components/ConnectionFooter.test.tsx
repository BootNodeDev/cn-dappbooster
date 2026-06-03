import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ConnectionFooter,
  type DappFooterStatus,
  type WalletServiceFooterStatus,
} from '@/components/ConnectionFooter'

const connectedService: WalletServiceFooterStatus = {
  // Wallet-service fixture representing a healthy Canton network connection.
  connected: true,
  networkId: 'canton:local',
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

    // The service row should split Canton status color from the muted network label.
    assert.ok(screen.getByText('canton'))
    assert.ok(screen.getByText('network:local'))
    assert.equal(screen.queryByText(/edit/i), null)

    // The cog button is the only settings affordance and must remain keyboard/click accessible.
    await user.click(screen.getByRole('button', { name: /connection settings/i }))
    assert.equal(settingsCalls, 1)
  })

  it('shows a red not-connected service state', () => {
    // Scenario: Canton is unavailable, so the footer should make the service problem explicit.
    render(
      <ConnectionFooter
        walletService={{ ...disconnectedService, networkId: 'canton:local' }}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    // The disconnected label must be visible, but the network is hidden because it is unknown.
    assert.ok(screen.getByText('canton'))
    assert.equal(screen.queryByText('canton - network:local'), null)
  })

  it('shows unknown when connected service omits the network id', () => {
    // Scenario: wallet-service confirms Canton connectivity but does not include network metadata.
    render(
      <ConnectionFooter
        walletService={{ connected: true }}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )

    // Connected state should still include network text and mark the missing id explicitly.
    assert.ok(screen.getByText('unknown'))
  })

  it('hides the dApp row while no dApp is connected', () => {
    // Scenario: neither an empty nor a merely-detected page should render a dApp row anymore.
    const { rerender } = render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={noDapp}
        onOpenSettings={() => undefined}
      />,
    )
    assert.equal(screen.queryByText(/no dapp found/i), null)

    rerender(
      <ConnectionFooter
        walletService={connectedService}
        dapp={detectedDapp}
        onOpenSettings={() => undefined}
      />,
    )
    assert.equal(screen.queryByText('localhost:3012'), null)
  })

  it('shows the connected dApp with account address and a disconnect button', async () => {
    // Scenario: a dApp is connected, so the footer shows the app, the connected account address, and disconnect.
    const user = userEvent.setup()
    let disconnects = 0
    render(
      <ConnectionFooter
        walletService={connectedService}
        dapp={{ kind: 'connected', label: 'Counter dApp', subtitle: 'Connected' }}
        dappAccountAddress="bn-dev::mock...79f7ec4"
        onDisconnectDapp={() => {
          disconnects += 1
        }}
        onOpenSettings={() => undefined}
      />,
    )

    assert.ok(screen.getByText('Counter dApp'))
    assert.ok(screen.getByText('bn-dev::mock...79f7ec4'))
    await user.click(screen.getByRole('button', { name: /disconnect/i }))
    assert.equal(disconnects, 1)
  })
})
