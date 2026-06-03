import { PrimaryButton } from '@/components/ui/Button'
import { CARD_CLASS } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/TextInput'
import { cn } from '@/utils/cn'

interface PairDappCardProps {
  pairingDraft: string
  pairingBusy: boolean
  onPairingDraftChange: (value: string) => void
  onPair: () => void
}

// Pairing entry point shown only while no dApp is connected; the connected state lives in the footer.
export const PairOrConnectedCard = ({
  pairingDraft,
  pairingBusy,
  onPairingDraftChange,
  onPair,
}: PairDappCardProps): JSX.Element => (
  <section className={cn(CARD_CLASS, 'p-3.5')}>
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-[1.15rem] font-semibold tracking-tight text-foreground">
          Connect to dApp
        </h2>
        <p className="mt-1 text-soft text-[0.9rem] leading-relaxed">Paste a WalletConnect URI</p>
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
  </section>
)
