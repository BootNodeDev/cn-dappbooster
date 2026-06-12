import QRCode from 'react-qr-code'
import { CopyPartyIdButton } from '@/components/CopyPartyIdButton'

interface TokenReceiveProps {
  partyId: string
}

// Receive screen: a scannable QR of the party id with the full id and copy below.
export const TokenReceive = ({ partyId }: TokenReceiveProps): JSX.Element => (
  <div className="flex flex-col items-center gap-5">
    {/* Fixed light QR keeps it scannable in dark mode too. */}
    <div
      data-testid="receive-qr"
      className="rounded-xl border border-border bg-white p-4"
    >
      <QRCode
        value={partyId}
        size={208}
        bgColor="#ffffff"
        fgColor="#14152b"
        level="M"
      />
    </div>
    <div className="w-full">
      <div className="mb-1.5 px-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Your party ID
      </div>
      <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2.5">
        <span className="min-w-0 flex-1 break-all font-mono text-[0.8rem] leading-5 text-foreground">
          {partyId}
        </span>
        <CopyPartyIdButton partyId={partyId} />
      </div>
    </div>
  </div>
)
