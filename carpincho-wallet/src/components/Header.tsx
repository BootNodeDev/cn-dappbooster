import { useVault } from '../vault/useVault.js'
import { CarpinchoLogo } from './CarpinchoLogo.js'

export const Header = (): JSX.Element => {
  const v = useVault()
  return (
    <header className="brand-bar">
      <CarpinchoLogo size={44} />
      <div className="flex-grow-1">
        <h1>Carpincho Wallet</h1>
        <div className="brand-sub">Argentine Canton vault · {v.isLocked ? 'locked' : 'unlocked'}</div>
      </div>
      {!v.isLocked && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => v.lock()}
        >
          Lock
        </button>
      )}
    </header>
  )
}
