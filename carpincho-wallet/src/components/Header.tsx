import { useVault } from '../vault/useVault.js'
import { CarpinchoLogo } from './CarpinchoLogo.js'

export const Header = (): JSX.Element => {
  const v = useVault()
  return (
    <header className="brand-bar">
      <div className="brand-mark">
        <CarpinchoLogo size={40} />
      </div>
      <div className="flex-grow-1">
        <h1>Carpincho Wallet</h1>
        <div className="brand-sub">{v.isLocked ? 'Locked' : 'Unlocked'} Canton signer</div>
      </div>
      {!v.isLocked && (
        <button
          type="button"
          className="lock-button"
          onClick={() => v.lock()}
        >
          Lock
        </button>
      )}
    </header>
  )
}
