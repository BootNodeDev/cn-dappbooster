import { CarpinchoLogo } from '@/components/CarpinchoLogo.tsx'
import { ICON_BUTTON_CLASS, ROUND_ICON_BUTTON_CHROME } from '@/components/ui/Button.tsx'
import { MENU_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'
import { useVault } from '@/vault/useVault.ts'

interface HeaderProps {
  onOpenMenu: () => void
}

export const Header = ({ onOpenMenu }: HeaderProps): JSX.Element => {
  const vault = useVault()
  return (
    <header className="flex items-center gap-3 pl-1 pr-1 pt-2 pb-3 mb-1 border-b border-border">
      <div className="size-9 grid place-items-center rounded-md bg-primary-soft overflow-hidden ring-1 ring-primary/15">
        <CarpinchoLogo size={28} />
      </div>
      <div className="grow min-w-0 leading-none">
        <h1 className="font-display text-[1.55rem] font-semibold m-0 text-foreground tracking-[-0.025em] lowercase">
          carpincho
        </h1>
        <div className="mt-1 font-mono text-[0.72rem] font-medium uppercase tracking-eyebrow text-muted-foreground">
          {vault.isLocked ? 'locked' : 'canton · signer'}
        </div>
      </div>
      {!vault.isLocked && (
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menu"
          title="Menu"
          className={cn(ICON_BUTTON_CLASS, ROUND_ICON_BUTTON_CHROME, 'size-9 bg-surface/85')}
        >
          {MENU_ICON}
        </button>
      )}
    </header>
  )
}
