import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus.ts'

const originalFetch = globalThis.fetch

// Renders the hook result as text so tests can assert the footer-facing state.
const StatusProbe = (): JSX.Element => {
  const status = useWalletServiceStatus({ pollMs: null })
  return <div>{status.connected ? 'connected' : 'not connected'}</div>
}

// Installs a fake wallet-service status response for one test scenario.
const installStatusResponse = (connected: boolean): void => {
  globalThis.fetch = async (input) => {
    // The hook should probe the configured JSON-RPC endpoint with the status method.
    assert.equal(String(input), 'http://localhost:3010/rpc')
    return new Response(
      JSON.stringify({
        result: {
          connection: {
            isNetworkConnected: connected,
          },
        },
      }),
      { status: 200 },
    )
  }
}

describe('useWalletServiceStatus', () => {
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('marks Canton connected when wallet-service reports network connectivity', async () => {
    // Scenario: wallet-service responds and says Canton network connectivity is healthy.
    installStatusResponse(true)

    // Render the hook and wait for the asynchronous status probe to settle.
    render(<StatusProbe />)

    // The footer state should become connected only after the health response confirms it.
    await waitFor(() => assert.ok(screen.getByText('connected')))
  })

  it('marks Canton not connected when wallet-service reports no network connectivity', async () => {
    // Scenario: wallet-service is reachable but reports that Canton itself is disconnected.
    installStatusResponse(false)

    // Render the hook and wait for the asynchronous status probe to settle.
    render(<StatusProbe />)

    // The footer state should stay disconnected when the reported network flag is false.
    await waitFor(() => assert.ok(screen.getByText('not connected')))
  })
})
