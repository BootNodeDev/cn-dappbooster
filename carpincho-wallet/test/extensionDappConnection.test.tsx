import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import {
  dappConnectionFromSources,
  faviconUrlForPage,
  useExtensionDappConnection,
} from '@/extension/dappConnection'
import type { ConnectedDappSession } from '@/wc/client'

type FakeChrome = {
  api: {
    runtime: {
      getURL: (path: string) => string
    }
    tabs: {
      query: (
        queryInfo: { active: true; currentWindow: true },
        callback: (tabs: Array<{ url?: string; title?: string; favIconUrl?: string }>) => void,
      ) => void
    }
  }
}

const originalChrome = (globalThis as { chrome?: unknown }).chrome

const session: ConnectedDappSession = {
  // Connected session fixture representing a dApp already paired with the wallet.
  topic: 'topic-1',
  name: 'Counter dApp',
  url: 'http://localhost:3012',
  description: 'Counter app',
  accounts: [],
}

const DappProbe = (): JSX.Element => {
  // Probe component renders hook state as text so the test verifies popup-visible behavior.
  const dapp = useExtensionDappConnection({ extensionMode: true, sessions: [] })
  return <div>{dapp.kind === 'none' ? 'No Dapp found' : `${dapp.label} ${dapp.subtitle}`}</div>
}

// Installs runtime.getURL and tabs.query APIs used by the popup dApp connection hook.
const installChrome = (activeTab?: {
  url?: string
  title?: string
  favIconUrl?: string
}): FakeChrome => {
  const fake: FakeChrome = {
    api: {
      runtime: {
        getURL: (path) => `chrome-extension://carpincho${path}`,
      },
      tabs: {
        query: (_queryInfo, callback) => {
          callback(activeTab === undefined ? [] : [activeTab])
        },
      },
    },
  }
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: fake.api,
  })
  return fake
}

describe('extension dApp connection helpers', () => {
  afterEach(() => {
    cleanup()
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome,
    })
  })

  it('builds a Chrome MV3 favicon URL for a communicating page', () => {
    // Scenario: the extension knows a page origin and should render that site's favicon locally.
    installChrome()

    // Build the favicon URL from the communicating page origin.
    const result = faviconUrlForPage('http://localhost:3012')

    // The URL must use Chrome's extension favicon endpoint and preserve the page URL as a query param.
    assert.equal(
      result,
      'chrome-extension://carpincho/_favicon/?pageUrl=http%3A%2F%2Flocalhost%3A3012&size=32',
    )
  })

  it('returns an empty state when no active web tab exists', () => {
    // Scenario: the popup opens with no readable http/https browser tab.
    const result = dappConnectionFromSources({ extensionMode: true, sessions: [] })

    // The footer should render the requested empty state.
    assert.deepEqual(result, { kind: 'none' })
  })

  it('uses the active tab as a detected but unconnected dApp', () => {
    // Scenario: the popup opens while the browser is pointed at a dApp page.
    installChrome()

    // Derive the displayed dApp row from the active tab URL.
    const result = dappConnectionFromSources({
      extensionMode: true,
      sessions: [],
      activeTab: {
        url: 'http://localhost:3012/counter',
        favIconUrl: 'http://localhost:3012/favicon.ico',
      },
    })

    // The footer should show the active host, not the empty state.
    assert.deepEqual(result, {
      kind: 'detected',
      label: 'localhost:3012',
      subtitle: 'Not connected',
      faviconUrl: 'http://localhost:3012/favicon.ico',
    })
  })

  it('uses a connected WalletConnect session when one exists', () => {
    // Scenario: the wallet already has an active dApp session.
    installChrome()

    // Derive the displayed dApp row from the first connected session.
    const result = dappConnectionFromSources({
      extensionMode: false,
      sessions: [session],
    })

    // Connected sessions take precedence and use the dApp name with a connected subtitle.
    assert.deepEqual(result, {
      kind: 'connected',
      label: 'Counter dApp',
      subtitle: 'Connected',
      faviconUrl:
        'chrome-extension://carpincho/_favicon/?pageUrl=http%3A%2F%2Flocalhost%3A3012&size=32',
    })
  })

  it('marks the active tab connected when it matches an active session origin', () => {
    // Scenario: the active tab is the same site as the paired WalletConnect session.
    installChrome()

    // Derive the displayed dApp row from both the active tab and connected session.
    const result = dappConnectionFromSources({
      extensionMode: true,
      sessions: [session],
      activeTab: {
        url: 'http://localhost:3012/counter',
      },
    })

    // The active tab stays the displayed row while the subtitle reflects the matched connection.
    assert.deepEqual(result, {
      kind: 'connected',
      label: 'localhost:3012',
      subtitle: 'Connected',
      faviconUrl:
        'chrome-extension://carpincho/_favicon/?pageUrl=http%3A%2F%2Flocalhost%3A3012%2Fcounter&size=32',
    })
  })

  it('marks the active tab connected when direct provider state tracks the same origin', () => {
    // Scenario: a dApp connected through the injected browser provider, so there is no WalletConnect session.
    installChrome()

    // Use the connected origin recorded by the extension background and an active tab on a nested route.
    const result = dappConnectionFromSources({
      extensionMode: true,
      sessions: [],
      directConnectedOrigins: ['http://localhost:3012'],
      activeTab: {
        url: 'http://localhost:3012/counter',
      },
    })

    // The footer should treat the active tab as connected because its origin matches direct provider state.
    assert.deepEqual(result, {
      kind: 'connected',
      label: 'localhost:3012',
      subtitle: 'Connected',
      faviconUrl:
        'chrome-extension://carpincho/_favicon/?pageUrl=http%3A%2F%2Flocalhost%3A3012%2Fcounter&size=32',
    })
  })

  it('reads the active tab when the popup opens', async () => {
    // Scenario: the active tab points at GitHub and has not communicated with the wallet.
    installChrome({
      url: 'https://github.com/BootNodeDev/cn-dappbooster',
      favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
    })

    // Render the popup hook with no pending requests and no connected sessions.
    render(<DappProbe />)

    // The footer should show the active tab host instead of the empty state.
    await waitFor(() => assert.ok(screen.getByText('github.com Not connected')))
  })
})
