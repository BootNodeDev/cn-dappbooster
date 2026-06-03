import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { CARD_CLASS } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/TextInput'
import { cn } from '@/utils/cn'
import type { ConnectedDappSession } from '@/wc/client'

interface PairOrConnectedCardProps {
  sessions: ConnectedDappSession[]
  pairingDraft: string
  pairingBusy: boolean
  busy: boolean
  onPairingDraftChange: (value: string) => void
  onPair: () => void
  onDisconnect: (topic: string) => void
}

export const PairOrConnectedCard = ({
  sessions,
  pairingDraft,
  pairingBusy,
  busy,
  onPairingDraftChange,
  onPair,
  onDisconnect,
}: PairOrConnectedCardProps): JSX.Element => {
  const connectedSession = sessions[0]

  return (
    <section className={cn(CARD_CLASS, 'p-3.5')}>
      {connectedSession !== undefined ? (
        <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
          <img
            className="size-8 rounded-full object-cover"
            src="/Walletconnect-logo.png"
            alt=""
            aria-hidden="true"
          />
          <div className="min-w-0">
            <strong className="block truncate text-foreground text-[1rem] font-semibold tracking-tight">
              {connectedSession.name}
            </strong>
            <small className="block truncate text-muted-foreground text-[0.86rem] font-mono font-medium">
              {connectedSession.url}
            </small>
            {sessions.length > 1 && (
              <div className="mt-1 text-muted-foreground text-[0.82rem] font-medium">
                +{sessions.length - 1} more
              </div>
            )}
          </div>
          <SecondaryButton
            className="min-w-[88px]"
            onClick={() => onDisconnect(connectedSession.topic)}
            disabled={busy}
          >
            Disconnect
          </SecondaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-[1.15rem] font-semibold tracking-tight text-foreground">
              Connect to dApp
            </h2>
            <p className="mt-1 text-soft text-[0.9rem] leading-relaxed">
              Paste a WalletConnect URI to link this wallet with a dApp.
            </p>
          </div>
          <TextInput
            className="w-full font-mono text-[0.92rem]"
            value={pairingDraft}
            onChange={(event) => onPairingDraftChange(event.target.value)}
            placeholder="wc:..."
          />
          <PrimaryButton
            className="w-full"
            onClick={onPair}
            disabled={pairingBusy || pairingDraft.trim() === ''}
          >
            {pairingBusy ? 'Pairing…' : 'Connect'}
          </PrimaryButton>
        </div>
      )}
    </section>
  )
}
