import { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Toaster, toast } from 'sonner'
import { formatPartyId, shortenIdentifier } from './utils/formatPartyId'

// Wallet-connectivity container for the dApp starter. Owns connect/disconnect,
// the pairing popover, the connected-party display, and lock handling — and
// gates the workspace: it renders `children` only when the wallet is connected,
// unlocked, and an active party is selected, behind a feature-independent
// `workspace-ready` marker.
export const ConnectionBar = ({ children }: { children: ReactNode }): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected, pairingUri } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()

  const [pairingCopied, setPairingCopied] = useState(false)
  const [connectMode, setConnectMode] = useState<'extension' | 'walletconnect' | undefined>(
    undefined,
  )

  const onConnect = async (mode: 'extension' | 'walletconnect'): Promise<void> => {
    setConnectMode(mode)
    try {
      await connect(mode)
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

  return (
    <main className="shell">
      <Toaster position="bottom-center" richColors />
      <h1 className="app-title">Canton dApp Starter</h1>

      {!isConnected ? (
        <section className="session-controls" aria-label="Connect wallet">
          <button
            className="connect-chip carpincho-connect"
            data-testid="connect-extension"
            type="button"
            onClick={() => {
              void onConnect('extension')
            }}
            disabled={isConnecting}
          >
            <span className="connect-glyph" aria-hidden="true">
              C
            </span>
            <span>{isConnecting && connectMode === 'extension' ? 'Connecting' : 'Carpincho'}</span>
          </button>
          <button
            className="connect-chip"
            data-testid="connect-walletconnect"
            type="button"
            onClick={() => {
              void onConnect('walletconnect')
            }}
            disabled={isConnecting}
          >
            <img src="/Walletconnect-logo.png" alt="" aria-hidden="true" />
            <span>{isConnecting && connectMode === 'walletconnect' ? 'Pairing' : 'WC'}</span>
          </button>
        </section>
      ) : (
        <div className="session-controls">
          <span
            className="connected-party"
            data-testid="connected-party"
            data-party-id={party?.partyId ?? ''}
          >
            party:{formatPartyId(party?.partyId ?? '')}
          </span>
          <button
            className="logout-icon"
            data-testid="logout"
            type="button"
            onClick={() => {
              void onDisconnect()
            }}
            aria-label="Disconnect wallet"
            title="Disconnect wallet"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      )}

      {!isConnected && (isConnecting || pairingUri !== undefined) && (
        <div className="pairing-popover">
          {pairingUri === undefined ? (
            <div className="pairing-loading">
              <span className="spinner" />
              <span>
                {connectMode === 'walletconnect'
                  ? 'Preparing WalletConnect...'
                  : 'Waiting for Carpincho...'}
              </span>
            </div>
          ) : (
            <>
              <span>Paste in Carpincho</span>
              <code>{shortenIdentifier(pairingUri)}</code>
              <div>
                <button
                  className={pairingCopied ? 'copied' : undefined}
                  type="button"
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
        <section className="workspace-panel" data-testid="wallet-locked-banner">
          <div className="panel-title-row">
            <div>
              <span className="section-kicker">Wallet locked</span>
              <h2>Unlock Carpincho to continue</h2>
            </div>
          </div>
          <p>
            Your wallet is locked. Open Carpincho and enter your password — this dApp will resume
            automatically.
          </p>
        </section>
      )}

      <section className="workspace-panel">
        {!isConnected || party === undefined ? (
          <div className="empty">
            <p className="empty-title">Connect to continue</p>
          </div>
        ) : isLocked ? (
          <div className="empty">
            <p className="empty-title">Wallet locked — unlock Carpincho to continue.</p>
          </div>
        ) : (
          <div data-testid="workspace-ready">{children}</div>
        )}
      </section>
    </main>
  )
}
