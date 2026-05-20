import { useEffect, useMemo, useState } from 'react'
import type { ConnectedDappSession } from '@/wc/client.ts'

interface ChromeTab {
  url?: string
  title?: string
  favIconUrl?: string
}

interface ChromeApi {
  runtime?: {
    getURL: (path: string) => string
  }
  tabs?: {
    query: (
      queryInfo: { active: true; currentWindow: true },
      callback: (tabs: ChromeTab[]) => void,
    ) => void
  }
}

export type DappConnectionStatus =
  | { kind: 'none' }
  | { kind: 'detected' | 'connected'; label: string; subtitle: string; faviconUrl?: string }

interface DappConnectionSources {
  extensionMode: boolean
  sessions: ConnectedDappSession[]
  activeTab?: ChromeTab
}

// Reads the Chrome runtime only when the popup is running inside the extension.
const chromeApi = (): ChromeApi | undefined => (globalThis as { chrome?: ChromeApi }).chrome

// Builds Chrome's Manifest V3 favicon URL for a page the extension already knows about.
export const faviconUrlForPage = (pageUrl: string): string | undefined => {
  const api = chromeApi()?.runtime
  if (api === undefined) {
    return undefined
  }
  const url = new URL(api.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', '32')
  return url.toString()
}

// Returns the best compact label for a dApp page URL.
const labelFromUrl = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// Active-tab metadata only exists for normal web pages the popup can inspect.
const normalizedWebTab = (tab: ChromeTab | undefined): ChromeTab | undefined => {
  if (tab?.url === undefined) {
    return undefined
  }
  try {
    const url = new URL(tab.url)
    return url.protocol === 'http:' || url.protocol === 'https:' ? tab : undefined
  } catch {
    return undefined
  }
}

// Compares dApp session URLs by origin so route changes do not break connected-state display.
const sameOrigin = (left: string, right: string): boolean => {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

// Reads the active tab when the extension popup is opened.
const queryActiveTab = async (): Promise<ChromeTab | undefined> =>
  await new Promise((resolve) => {
    const tabs = chromeApi()?.tabs
    if (tabs === undefined) {
      resolve(undefined)
      return
    }
    tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(normalizedWebTab(tab))
    })
  })

// Derives the footer dApp row from the active tab and active WalletConnect sessions.
export const dappConnectionFromSources = ({
  extensionMode,
  sessions,
  activeTab,
}: DappConnectionSources): DappConnectionStatus => {
  const tab = normalizedWebTab(activeTab)
  if (extensionMode) {
    if (tab?.url === undefined) {
      return { kind: 'none' }
    }
    const connected = sessions.some((session) => sameOrigin(session.url, tab.url as string))
    return {
      kind: connected ? 'connected' : 'detected',
      label: labelFromUrl(tab.url),
      subtitle: connected ? 'Connected' : 'Not connected',
      faviconUrl: tab.favIconUrl ?? faviconUrlForPage(tab.url),
    }
  }

  const connectedSession = sessions[0]
  if (connectedSession !== undefined) {
    return {
      kind: 'connected',
      label:
        connectedSession.name.trim() === ''
          ? labelFromUrl(connectedSession.url)
          : connectedSession.name,
      subtitle: 'Connected',
      faviconUrl: faviconUrlForPage(connectedSession.url),
    }
  }

  return { kind: 'none' }
}

// Memoizes the current dApp footer state from wallet runtime inputs.
export const useExtensionDappConnection = (
  sources: DappConnectionSources,
): DappConnectionStatus => {
  const { extensionMode, sessions } = sources
  const [activeTab, setActiveTab] = useState<ChromeTab | undefined>(sources.activeTab)

  useEffect(() => {
    if (!extensionMode) {
      return
    }
    void queryActiveTab().then(setActiveTab)
  }, [extensionMode])

  return useMemo(
    () => dappConnectionFromSources({ extensionMode, sessions, activeTab }),
    [activeTab, extensionMode, sessions],
  )
}
