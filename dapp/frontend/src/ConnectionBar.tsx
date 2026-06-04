import { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { DISCONNECT_ICON, MOON_ICON, SUN_ICON } from '@/components/ui/icons'
import { toast } from '@/components/ui/toast'
import { useTheme } from '@/theme/useTheme'
import { formatPartyId, shortenIdentifier } from './utils/formatPartyId'

const CHIP_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-muted px-3 ' +
  'text-xs font-extrabold text-primary-ink transition-colors enabled:hover:border-primary ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const ICON_CHIP_CLASS =
  'inline-grid size-9 place-items-center rounded-full border border-border bg-surface ' +
  'text-muted-foreground transition-colors hover:text-primary hover:bg-primary-soft'

// Wallet-connectivity container for the dApp starter. Owns connect/disconnect,
// the pairing popover, the connected-party display, lock handling, and the theme
// toggle — and gates the workspace: it renders `children` only when the wallet is
// connected, unlocked, and an active party is selected, behind a feature-
// independent `workspace-ready` marker.
export const ConnectionBar = ({ children }: { children: ReactNode }): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected, pairingUri } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { mode, setMode } = useTheme()

  const [pairingCopied, setPairingCopied] = useState(false)
  const [connectMode, setConnectMode] = useState<'extension' | 'walletconnect' | undefined>(
    undefined,
  )

  // Default is `system` (set by ThemeProvider when nothing is stored yet); the
  // toggle itself only ever flips between explicit light and dark. From the
  // unset `system` state, resolve the active theme so the first click inverts it.
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
    setPairingCopied(false)
    await disconnect()
    toast.success('Disconnected.')
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

  return (
    <main className="mx-auto w-[min(600px,calc(100vw-28px))] rounded-3xl bg-surface p-5 shadow-card">
      <h1 className="mb-3.5 text-center font-display text-2xl font-extrabold text-foreground">
        Canton dApp Starter
      </h1>

      {!isConnected ? (
        <section
          className="mb-3.5 flex items-center justify-center gap-2"
          aria-label="Connect wallet"
        >
          <button
            className={CHIP_CLASS}
            data-testid="connect-extension"
            type="button"
            onClick={() => {
              void onConnect('extension')
            }}
            disabled={isConnecting}
          >
            <span
              className="grid size-5 place-items-center rounded-md bg-primary text-[0.7rem] font-extrabold text-primary-foreground"
              aria-hidden="true"
            >
              C
            </span>
            <span>{isConnecting && connectMode === 'extension' ? 'Connecting' : 'Carpincho'}</span>
          </button>
          <button
            className={CHIP_CLASS}
            data-testid="connect-walletconnect"
            type="button"
            onClick={() => {
              void onConnect('walletconnect')
            }}
            disabled={isConnecting}
          >
            <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" className="size-[18px]" />
            <span>{isConnecting && connectMode === 'walletconnect' ? 'Pairing' : 'WC'}</span>
          </button>
          {themeToggle}
        </section>
      ) : (
        <div className="mb-3.5 flex items-center justify-center gap-2">
          <span
            className="max-w-[min(170px,42vw)] truncate text-xs font-extrabold leading-9 text-foreground"
            data-testid="connected-party"
            data-party-id={party?.partyId ?? ''}
          >
            party:{formatPartyId(party?.partyId ?? '')}
          </span>
          <button
            className="inline-grid size-9 place-items-center rounded-full border border-danger/40 bg-surface text-danger transition-colors hover:bg-danger-soft"
            data-testid="logout"
            type="button"
            onClick={() => {
              void onDisconnect()
            }}
            aria-label="Disconnect wallet"
            title="Disconnect wallet"
          >
            {DISCONNECT_ICON}
          </button>
          {themeToggle}
        </div>
      )}

      {!isConnected && (isConnecting || pairingUri !== undefined) && (
        <div className="mx-auto mb-3 w-[min(320px,calc(100vw-32px))] rounded-2xl border border-border bg-muted p-3">
          {pairingUri === undefined ? (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              <span>
                {connectMode === 'walletconnect'
                  ? 'Preparing WalletConnect...'
                  : 'Waiting for Carpincho...'}
              </span>
            </div>
          ) : (
            <>
              <span className="mb-2 block text-sm font-extrabold text-primary-ink">
                Paste in Carpincho
              </span>
              <code className="block truncate rounded-lg border border-border bg-surface p-2 font-mono text-xs text-muted-foreground">
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

      {isConnected && isLocked && (
        <section className="mb-3.5 rounded-2xl bg-muted p-4" data-testid="wallet-locked-banner">
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
      )}

      <section className="rounded-2xl bg-muted p-4">
        {!isConnected || party === undefined ? (
          <div className="rounded-xl bg-surface p-4 text-muted-foreground">
            <p className="m-0 font-semibold text-soft">Connect to continue</p>
          </div>
        ) : isLocked ? (
          <div className="rounded-xl bg-surface p-4 text-muted-foreground">
            <p className="m-0 font-semibold text-soft">
              Wallet locked — unlock Carpincho to continue.
            </p>
          </div>
        ) : (
          <div data-testid="workspace-ready">{children}</div>
        )}
      </section>
    </main>
  )
}
