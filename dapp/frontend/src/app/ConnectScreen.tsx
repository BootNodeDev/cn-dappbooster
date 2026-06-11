import { useState } from 'react'
import { Card } from '@/components/Card'
import { CheckIcon, CopyIcon } from '@/components/icons'
import { toast } from '@/components/toast'
import { walletConnectEnabled } from '@/wallet/ConnectKitConfig'
import { useConnect } from '@/wallet/hooks'
import { writeReconnect } from '@/wallet/reconnect'
import { ThemeToggle } from './ThemeToggle'

// Pre-connection landing. The dApp connects an external Carpincho wallet — the
// browser extension is the primary path, the WalletConnect (Carpincho web app)
// path is secondary and only offered when a WalletConnect project id is set.

// The drift float lives here because the shared stylesheet has no `animate-drift`
// utility; this scoped block keeps the brand mark gently in motion (and honours
// reduced-motion) without touching the global CSS.
const driftStyles = `
@keyframes connect-drift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(2deg); }
}
.animate-drift {
  animation: connect-drift 6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-drift {
    animation: none;
  }
}
`

// Brand mark: a brand-gradient square with a glow. `drift` floats it gently.
const BrandMark = ({ className }: { className: string }): React.JSX.Element => (
  <span className={`bg-[image:var(--gradient-brand)] shadow-[var(--glow)] ${className}`} />
)

export const ConnectScreen = (): React.JSX.Element => {
  const { connect, isConnecting, connectError, pairingUri } = useConnect()
  const [pairingCopied, setPairingCopied] = useState(false)

  const onConnect = async (mode: 'extension' | 'walletconnect'): Promise<void> => {
    try {
      await connect(mode)
      if (mode === 'extension') {
        writeReconnect('extension')
      }
      toast.success('Wallet connected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const copyPairingUri = async (): Promise<void> => {
    if (pairingUri === undefined) {
      return
    }
    try {
      await navigator.clipboard.writeText(pairingUri)
      setPairingCopied(true)
      window.setTimeout(() => setPairingCopied(false), 1400)
    } catch {
      toast.error('Could not copy the pairing link')
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <style>{driftStyles}</style>

      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-8 rounded-xl" />
          <span className="text-base font-extrabold tracking-tight text-fg">Canton Vesting</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <BrandMark className="animate-drift mb-8 size-24 rounded-[1.75rem]" />

        <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-5xl">
          Vesting for Canton Coin
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-fg-muted">
          Grants vest to you, you claim what has unlocked, and you can create grants for others.
          <br className="hidden sm:block" /> Escrow is held on-ledger and every claim is a real
          Canton transaction.
        </p>

        <p className="mt-9 text-lg font-bold text-fg">Connect your wallet to begin</p>

        <button
          type="button"
          onClick={() => void onConnect('extension')}
          disabled={isConnecting}
          className="relative isolate mt-4 inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-full border border-primary bg-primary px-7 text-[0.95rem] font-semibold text-primary-fg transition before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--gradient-brand)] before:opacity-0 before:transition-opacity enabled:hover:border-transparent enabled:hover:shadow-[var(--glow)] enabled:hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs font-black">
            C
          </span>
          {isConnecting ? 'Connecting…' : 'Carpincho Wallet'}
        </button>
        <p className="mt-1.5 text-xs text-fg-muted">(browser extension)</p>

        {walletConnectEnabled && (
          <>
            <div className="mt-5 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              <span className="h-px w-8 bg-border" /> or <span className="h-px w-8 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => void onConnect('walletconnect')}
              disabled={isConnecting}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-6 text-[0.95rem] font-semibold text-fg transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? 'Pairing…' : 'WalletConnect'}
            </button>
            <p className="mt-1.5 text-xs text-fg-muted">(Carpincho web app)</p>
          </>
        )}

        {pairingUri !== undefined && (
          <Card className="mt-7 w-full max-w-md p-5 text-left">
            <p className="text-sm text-fg-muted">
              Paste this pairing link into the Carpincho web app to connect.
            </p>
            <div className="mt-3 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-muted p-3 font-mono text-xs text-fg">
                {pairingUri}
              </code>
              <button
                type="button"
                aria-label="Copy pairing link"
                title="Copy pairing link"
                onClick={() => void copyPairingUri()}
                className={
                  pairingCopied
                    ? 'inline-grid size-11 shrink-0 place-items-center rounded-lg border border-success/40 bg-success-soft text-success'
                    : 'inline-grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary'
                }
              >
                {pairingCopied ? (
                  <CheckIcon width={16} height={16} />
                ) : (
                  <CopyIcon width={16} height={16} />
                )}
              </button>
            </div>
          </Card>
        )}

        {connectError !== undefined && (
          <p className="mt-5 max-w-md text-sm font-semibold text-danger">{connectError.message}</p>
        )}
      </main>
    </div>
  )
}
