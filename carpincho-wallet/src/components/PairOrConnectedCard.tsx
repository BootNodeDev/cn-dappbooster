import { PrimaryButton, SecondaryButton } from '@/components/ui/Button.tsx'
import { CARD_CLASS } from '@/components/ui/Card.tsx'
import { TextInput } from '@/components/ui/TextInput.tsx'
import { cn } from '@/utils/cn.ts'
import type { ConnectedDappSession } from '@/wc/client.ts'

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
        <div>
          <div className="font-mono text-[0.74rem] font-semibold uppercase tracking-eyebrow text-muted-foreground mb-2">
            Pair a dApp
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
            <TextInput
              className="font-mono text-[0.92rem]"
              value={pairingDraft}
              onChange={(event) => onPairingDraftChange(event.target.value)}
              placeholder="wc:..."
            />
            <PrimaryButton
              className="min-w-[88px]"
              onClick={onPair}
              disabled={pairingBusy || pairingDraft.trim() === ''}
            >
              {pairingBusy ? 'Pairing…' : 'Connect'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </section>
  )
}
