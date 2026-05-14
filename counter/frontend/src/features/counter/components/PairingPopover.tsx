import { short } from '../counterHelpers.js'

interface PairingPopoverProps {
  pairingUri: string | undefined
  pairingCopied: boolean
  onCopyPairingUri: () => Promise<void>
  onCancelPairing: () => void
}

export const PairingPopover = ({
  pairingUri,
  pairingCopied,
  onCopyPairingUri,
  onCancelPairing
}: PairingPopoverProps): JSX.Element => {
  if (pairingUri === undefined) {
    return (
      <div className="pairing-popover">
        <div className="pairing-loading">
          <span className="spinner" />
          <span>Preparing WalletConnect...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pairing-popover">
      <span>Paste in Carpincho</span>
      <code>{short(pairingUri)}</code>
      <div>
        <button
          className={pairingCopied ? 'copied' : undefined}
          type="button"
          onClick={() => { void onCopyPairingUri() }}
        >
          {pairingCopied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={onCancelPairing}>
          Cancel
        </button>
      </div>
    </div>
  )
}
