import { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  CHEVRON_DOWN_ICON,
  COPY_ICON,
  DISCONNECT_ICON,
  MOON_ICON,
  SUN_ICON,
} from '@/components/ui/icons'
import { toast } from '@/components/ui/toast'
import { useTheme } from '@/theme/useTheme'
import { formatPartyId, shortenIdentifier } from './utils/formatPartyId'

const ICON_CHIP_CLASS =
  'inline-grid size-9 place-items-center rounded-full border border-border bg-surface ' +
  'text-muted-foreground transition-colors hover:text-primary hover:bg-primary-soft'

// App brand mark — a stamp on the brand gradient. This is the dApp's own logo
// (the loyalty stamp metaphor); carpincho's capybara is reserved for the wallet
// connect buttons, where it identifies the wallet you connect with.
const StarMark = ({ className }: { className: string }): JSX.Element => (
  <span
    className={`grid place-items-center bg-[image:var(--bg-gradient-brand)] text-white ${className}`}
  >
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-1/2">
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  </span>
)

// Wallet-connectivity container for the dApp starter. Owns the header (brand +
// connect / account controls + theme toggle), the welcome hero shown while
// disconnected, the WalletConnect pairing popover, and lock handling — and gates
// the workspace: it renders `children` only when the wallet is connected,
// unlocked, and an active party is selected, behind a feature-independent
// `workspace-ready` marker.
export const ConnectionBar = ({ children }: { children: ReactNode }): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected, pairingUri } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { mode, setMode } = useTheme()

  const [pairingCopied, setPairingCopied] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [connectMode, setConnectMode] = useState<'extension' | 'walletconnect' | undefined>(
    undefined,
  )

  // The toggle only flips between explicit light and dark; the default stays
  // `system` (set by ThemeProvider) until the user picks one. Resolve the active
  // theme so the first click from the unset state inverts what's on screen.
  const resolvedTheme: 'light' | 'dark' =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode

  const toggleTheme = (): void => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const onConnect = async (connectVia: 'extension' | 'walletconnect'): Promise<void> => {
    setConnectMode(connectVia)
    try {
      await connect(connectVia)
      if (party !== undefined) {
        toast.success(`Connected as ${formatPartyId(party.partyId)}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setConnectMode(undefined)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setAccountOpen(false)
    setPairingCopied(false)
    await disconnect()
    toast.success('Disconnected.')
  }

  const copyPartyId = async (): Promise<void> => {
    if (party === undefined) {
      return
    }
    await navigator.clipboard.writeText(party.partyId)
    toast.success('Party id copied.')
  }

  const copyPairingUri = async (): Promise<void> => {
    if (pairingUri === undefined) {
      return
    }
    await navigator.clipboard.writeText(pairingUri)
    setPairingCopied(true)
    window.setTimeout(() => setPairingCopied(false), 1400)
  }

  const themeToggle = (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
      onClick={toggleTheme}
      className={ICON_CHIP_CLASS}
    >
      {resolvedTheme === 'dark' ? MOON_ICON : SUN_ICON}
    </button>
  )

  const connectControls = !isConnected ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="connect-extension"
        onClick={() => {
          void onConnect('extension')
        }}
        disabled={isConnecting}
        className="relative isolate inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-primary bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--bg-gradient-brand)] before:opacity-0 before:transition-opacity enabled:hover:border-transparent enabled:hover:shadow-glow enabled:hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src="/carpincho-icon.svg" alt="" aria-hidden="true" className="size-5 rounded-full" />
        <span>
          {isConnecting && connectMode === 'extension' ? 'Connecting…' : 'Carpincho Wallet'}
        </span>
      </button>
      <button
        type="button"
        data-testid="connect-walletconnect"
        onClick={() => {
          void onConnect('walletconnect')
        }}
        disabled={isConnecting}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-surface px-3 text-sm font-semibold text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" className="size-[18px]" />
        <span>
          {isConnecting && connectMode === 'walletconnect' ? 'Pairing…' : 'WalletConnect'}
        </span>
      </button>
    </div>
  ) : (
    <div className="relative">
      <button
        type="button"
        data-testid="connected-party"
        data-party-id={party?.partyId ?? ''}
        onClick={() => setAccountOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={accountOpen}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-foreground transition-colors hover:border-primary"
      >
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full bg-[image:var(--bg-gradient-brand)]"
        />
        <span className="truncate">{formatPartyId(party?.partyId ?? '')}</span>
        <span className="text-muted-foreground">{CHEVRON_DOWN_ICON}</span>
      </button>
      {accountOpen && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAccountOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-popover"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Connected party
            </span>
            <div className="mt-1 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-muted p-2 font-mono text-xs text-foreground">
                {party?.partyId ?? ''}
              </code>
              <button
                type="button"
                aria-label="Copy party id"
                title="Copy party id"
                onClick={() => {
                  void copyPartyId()
                }}
                className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary [&_svg]:size-4"
              >
                {COPY_ICON}
              </button>
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
        </>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <StarMark className="size-8 rounded-lg" />
            <span className="font-display text-base font-extrabold tracking-[-0.01em] text-foreground">
              Stampbook
            </span>
          </div>
          <div className="flex items-center gap-2">
            {themeToggle}
            {connectControls}
          </div>
        </div>
      </header>

      {!isConnected && (isConnecting || pairingUri !== undefined) && (
        <div className="fixed left-1/2 top-20 z-40 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 shadow-popover">
          {pairingUri === undefined ? (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              <span>
                {connectMode === 'walletconnect'
                  ? 'Preparing WalletConnect…'
                  : 'Waiting for Carpincho…'}
              </span>
            </div>
          ) : (
            <>
              <span className="mb-2 block text-sm font-extrabold text-primary-ink">
                Paste in your WalletConnect-compatible wallet
              </span>
              <code className="block truncate rounded-lg border border-border bg-muted p-2 font-mono text-xs text-muted-foreground">
                {shortenIdentifier(pairingUri)}
              </code>
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  className={
                    pairingCopied
                      ? 'inline-flex h-8 items-center rounded-full border border-success/30 bg-success-soft px-2.5 text-sm font-semibold text-success'
                      : 'inline-flex h-8 items-center rounded-full border border-border bg-surface px-2.5 text-sm font-semibold text-foreground hover:border-primary'
                  }
                  onClick={() => {
                    void copyPairingUri()
                  }}
                >
                  {pairingCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {!isConnected ? (
          <section className="flex flex-col items-center pt-10 pb-6 text-center sm:pt-20">
            <StarMark className="animate-drift mb-7 size-28 rounded-3xl" />
            <h1 className="max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl">
              Loyalty stamp cards, on-ledger
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              A demo on the Canton barebones stack. A merchant issues a stamp card, delegates
              stamping to staff, and cardholders watch their stamps add up toward a reward — every
              stamp a real Canton transaction.
            </p>
            <button
              type="button"
              data-testid="hero-connect"
              onClick={() => {
                void onConnect('extension')
              }}
              disabled={isConnecting}
              className="relative isolate mt-8 inline-flex h-11 items-center gap-2 overflow-hidden rounded-full border border-primary bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--bg-gradient-brand)] before:opacity-0 before:transition-opacity enabled:hover:border-transparent enabled:hover:shadow-glow enabled:hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img
                src="/carpincho-icon.svg"
                alt=""
                aria-hidden="true"
                className="size-6 rounded-full"
              />
              {isConnecting && connectMode === 'extension' ? 'Connecting…' : 'Carpincho Wallet'}
            </button>

            <div className="mt-4 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-px w-8 bg-border" />
              or
              <span className="h-px w-8 bg-border" />
            </div>

            <button
              type="button"
              data-testid="hero-connect-walletconnect"
              onClick={() => {
                void onConnect('walletconnect')
              }}
              disabled={isConnecting}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-6 text-[0.95rem] font-semibold text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" className="size-5" />
              {isConnecting && connectMode === 'walletconnect' ? 'Pairing…' : 'WalletConnect'}
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
              Your wallet is locked. Open Carpincho and enter your password — this dApp will resume
              automatically.
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
