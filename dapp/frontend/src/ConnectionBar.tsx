import { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  CHEVRON_DOWN_ICON,
  COPY_ICON,
  DISCONNECT_ICON,
  MOON_ICON,
  SUN_ICON,
} from '@/components/ui/icons'
import { toast } from '@/components/ui/toast'
import { useTheme } from '@/theme/useTheme'
import { loadRuntimeConfig } from './runtimeConfig'
import { copyToClipboard } from './utils/clipboard'
import { errorMessage } from './utils/errorMessage'
import { formatPartyId } from './utils/formatPartyId'

const ICON_CHIP_CLASS =
  'inline-grid size-9 place-items-center rounded-full border border-border bg-surface ' +
  'text-muted-foreground transition-colors hover:text-primary hover:bg-primary-soft'

// Remember an extension connection so a reload can silently reconnect.
const RECONNECT_KEY = 'bn-canton-stampbook:reconnect'
const readReconnect = (): string | null => {
  try {
    return window.localStorage.getItem(RECONNECT_KEY)
  } catch {
    return null
  }
}
const writeReconnect = (value: string | null): void => {
  try {
    if (value === null) {
      window.localStorage.removeItem(RECONNECT_KEY)
    } else {
      window.localStorage.setItem(RECONNECT_KEY, value)
    }
  } catch {
    // ignore quota / privacy errors
  }
}

// Wallet header (connect/account + theme), welcome hero, and lock gating;
// renders children only when connected + unlocked behind workspace-ready.
export const ConnectionBar = ({ children }: { children: ReactNode }): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { mode, setMode } = useTheme()
  const network = loadRuntimeConfig().cantonNetwork

  const [accountOpen, setAccountOpen] = useState(false)
  // Seeded before first paint so the reconnect check shows a spinner, not the hero.
  const [reconnecting, setReconnecting] = useState(() => readReconnect() === 'extension')

  const accountMenuRef = useRef<HTMLDivElement>(null)
  // Set by a user-initiated connect; the success toast fires from the effect
  // below once `party` lands (connect() resolves before the context updates).
  const connectToastPending = useRef(false)
  // Guards the mount-only silent reconnect against StrictMode's double-invoke.
  const reconnectStarted = useRef(false)

  useEffect(() => {
    if (party !== undefined && connectToastPending.current) {
      connectToastPending.current = false
      toast.success(`Connected as ${formatPartyId(party.partyId)}`)
    }
  }, [party])

  // Close the account menu on outside click / Escape (header backdrop-blur traps a
  // fixed backdrop, so use a document listener).
  useEffect(() => {
    if (!accountOpen) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (accountMenuRef.current !== null && !accountMenuRef.current.contains(target)) {
        setAccountOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  // Toggle flips light/dark only; resolve `system` so the first click inverts.
  const resolvedTheme: 'light' | 'dark' =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode

  const toggleTheme = (): void => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Silently reconnect a prior extension session on reload (WC reconnects manually).
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (isConnected || readReconnect() !== 'extension') {
      setReconnecting(false)
      return
    }
    if (reconnectStarted.current) {
      return
    }
    reconnectStarted.current = true
    void connect('extension')
      // Wallet no longer authorized or not present, so stay on the welcome screen.
      .catch(() => writeReconnect(null))
      .finally(() => setReconnecting(false))
  }, [])

  const onConnect = async (): Promise<void> => {
    connectToastPending.current = true
    try {
      await connect('extension')
      writeReconnect('extension')
      // Land on the trade view on connect; the router reads this when it mounts.
      window.history.replaceState({}, '', '/')
    } catch (err) {
      connectToastPending.current = false
      toast.error(errorMessage(err))
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setAccountOpen(false)
    // Drop any armed connect toast so a later party change can't fire a stale
    // "Connected as" after this disconnect.
    connectToastPending.current = false
    writeReconnect(null)
    await disconnect()
    toast.success('Disconnected.')
  }

  const copyPartyId = async (): Promise<void> => {
    if (party === undefined) {
      return
    }
    await copyToClipboard(party.partyId, 'Party id copied.')
  }

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  const themeToggle = (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
      className={ICON_CHIP_CLASS}
    >
      {resolvedTheme === 'dark' ? MOON_ICON : SUN_ICON}
    </button>
  )

  const connectControls = !isConnected ? (
    <button
      type="button"
      data-testid="connect-extension"
      onClick={() => {
        void onConnect()
      }}
      disabled={isConnecting}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-surface pl-2.5 pr-4 text-sm font-semibold text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <img src="/carpincho-icon.svg" alt="" aria-hidden="true" className="size-6 rounded-full" />
      {isConnecting ? 'Connecting…' : 'Connect'}
    </button>
  ) : (
    <div className="relative" ref={accountMenuRef}>
      <button
        type="button"
        data-testid="connected-party"
        data-party-id={party?.partyId ?? ''}
        onClick={() => setAccountOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={accountOpen}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-foreground transition-colors hover:border-primary"
      >
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full bg-[image:var(--bg-gradient-brand)]"
        />
        <span className="truncate">{(party?.partyId ?? '').split('::')[0]}</span>
        <span className="text-muted-foreground">{CHEVRON_DOWN_ICON}</span>
      </button>
      {accountOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-popover">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Connected party
          </span>
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-muted p-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {formatPartyId(party?.partyId ?? '')}
            </code>
            <button
              type="button"
              aria-label="Copy party id"
              title="Copy party id"
              onClick={() => {
                void copyPartyId()
              }}
              className="inline-grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-4"
            >
              {COPY_ICON}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {network}
          </div>
          <button
            type="button"
            data-testid="logout"
            onClick={() => {
              void onDisconnect()
            }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft [&_svg]:size-4"
          >
            {DISCONNECT_ICON}
            Disconnect
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-3 focus-visible:z-[70] focus-visible:rounded-md focus-visible:border focus-visible:border-border focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-foreground focus-visible:shadow-popover"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5" aria-label="CN Dark Pools home">
            <img src="/logo.svg" alt="CN Dark Pools" className="size-8 rounded-lg" />
            <span className="font-display text-base font-extrabold tracking-[-0.01em] text-foreground">
              CN Dark Pools
            </span>
          </a>
          <div className="flex items-center gap-2">
            {themeToggle}
            {reconnecting && !isConnected ? (
              <span
                role="status"
                aria-label="Checking wallet"
                className="inline-grid size-9 place-items-center"
              >
                <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              </span>
            ) : (
              connectControls
            )}
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 outline-none sm:px-6"
      >
        {reconnecting && !isConnected ? (
          <section className="flex flex-col items-center gap-3 pt-20 text-center text-muted-foreground">
            <span
              role="status"
              aria-label="Checking wallet"
              className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
            />
          </section>
        ) : !isConnected ? (
          <section className="flex flex-col items-center pt-10 pb-6 text-center sm:pt-20">
            <img
              src="/logo.svg"
              alt="CN Dark Pools"
              className="animate-drift mb-7 size-28 rounded-3xl"
            />
            <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl">
              Trade without
              <br />
              showing your hand
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              CN Dark Pools is a dark pool built on Canton. You place an order, it stays hidden
              until the venue finds the other side, and you both settle at the price in the middle.
              No public book for the room to read, nothing for bots to race ahead of.
            </p>
            <button
              type="button"
              data-testid="hero-connect"
              onClick={() => {
                void onConnect()
              }}
              disabled={isConnecting}
              className="relative isolate mt-9 inline-flex h-11 items-center gap-2 overflow-hidden rounded-full border border-primary bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--bg-gradient-brand)] before:opacity-0 before:transition-opacity enabled:hover:border-transparent enabled:hover:shadow-glow enabled:hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img
                src="/carpincho-icon.svg"
                alt=""
                aria-hidden="true"
                className="size-6 rounded-full"
              />
              {isConnecting ? 'Connecting…' : 'Connect Carpincho'}
            </button>
          </section>
        ) : isLocked ? (
          <section
            className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 shadow-card"
            data-testid="wallet-locked-banner"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Wallet locked
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Unlock Carpincho to continue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your wallet is locked. Open Carpincho and enter your password, and this dApp picks up
              where it left off.
            </p>
          </section>
        ) : party === undefined ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 text-muted-foreground shadow-card">
            <p className="m-0 font-semibold text-soft">
              Select an account in Carpincho to continue.
            </p>
          </div>
        ) : (
          <div data-testid="workspace-ready">{children}</div>
        )}
      </main>
    </div>
  )
}
