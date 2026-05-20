import { ICON_BUTTON_CLASS } from '@/components/ui/Button.tsx'
import { COG_ICON, DAPP_EMPTY_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'

export interface WalletServiceFooterStatus {
  connected: boolean
  reason?: string
}

export type DappFooterStatus =
  | { kind: 'none' }
  | { kind: 'detected' | 'connected'; label: string; subtitle: string; faviconUrl?: string }

interface ConnectionFooterProps {
  walletService: WalletServiceFooterStatus
  dapp: DappFooterStatus
  onOpenSettings: () => void
}

// Keeps service health and dApp communication visible as two separate footer states.
export const ConnectionFooter = ({
  walletService,
  dapp,
  onOpenSettings,
}: ConnectionFooterProps): JSX.Element => {
  const serviceLabel = walletService.connected ? 'canton connected' : 'canton not connected'
  const dotClass = walletService.connected ? 'bg-success' : 'bg-danger'

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-popup',
        'flex flex-col gap-2 border-t border-border bg-background/95 p-2 backdrop-blur-md',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
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
      </div>

      <div className="flex min-h-16 items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5">
        {dapp.kind === 'none' ? (
          <>
            <span className="grid size-9 place-items-center text-muted-foreground">
              {DAPP_EMPTY_ICON}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1rem] font-semibold text-muted-foreground">
                No Dapp found
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-primary">
              {dapp.faviconUrl === undefined ? (
                <span className="font-display text-[1.05rem] font-semibold">
                  {dapp.label.charAt(0).toUpperCase()}
                </span>
              ) : (
                <img
                  className="size-6 rounded-sm object-contain"
                  src={dapp.faviconUrl}
                  alt=""
                  aria-hidden="true"
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1rem] font-semibold leading-tight text-foreground">
                {dapp.label}
              </div>
              <div className="mt-0.5 truncate text-[0.9rem] font-medium leading-tight text-muted-foreground">
                {dapp.subtitle}
              </div>
            </div>
          </>
        )}
      </div>
    </footer>
  )
}
