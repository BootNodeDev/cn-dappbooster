import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { WalletControl } from './WalletControl'

export const TopBar = (): React.JSX.Element => (
  <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="size-8 rounded-xl shadow-[var(--glow)]" />
        <div className="leading-tight">
          <div className="text-[0.95rem] font-extrabold tracking-tight text-fg">
            Canton Coin Vesting
          </div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fg-muted">
            cc-vesting
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <WalletControl />
      </div>
    </div>
  </header>
)
