import { ICON_BUTTON_CLASS } from '@/components/ui/Button.tsx'
import { COG_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'

export interface WalletServiceFooterStatus {
  connected: boolean
  reason?: string
}

interface ConnectionFooterProps {
  walletService: WalletServiceFooterStatus
  onOpenSettings: () => void
}

// Keeps Canton service health visible without opening the connection settings sheet.
export const ConnectionFooter = ({
  walletService,
  onOpenSettings,
}: ConnectionFooterProps): JSX.Element => {
  const serviceLabel = walletService.connected ? 'canton connected' : 'canton not connected'
  const dotClass = walletService.connected ? 'bg-success' : 'bg-danger'

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-popup',
        'flex items-center gap-2 border-t border-border bg-surface/95 px-4 py-2.5 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full shrink-0', dotClass)}
      />
      <span
        className={cn(
          'flex-1 min-w-0 truncate font-mono text-[0.76rem] font-semibold uppercase tracking-[0.14em]',
          walletService.connected ? 'text-success' : 'text-danger',
        )}
        title={walletService.reason}
      >
        {serviceLabel}
      </span>
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Connection settings"
        title="Connection settings"
        className={cn(ICON_BUTTON_CLASS, 'size-8 rounded-sm text-soft')}
      >
        {COG_ICON}
      </button>
    </footer>
  )
}
