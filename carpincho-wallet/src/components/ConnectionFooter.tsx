import { ICON_BUTTON_CLASS } from '@/components/ui/Button.tsx'
import { COG_ICON, DAPP_EMPTY_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'

export interface WalletServiceFooterStatus {
  connected: boolean
  networkId?: string
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
  const dotClass = walletService.connected ? 'bg-success' : 'bg-danger'
  const networkLabel = walletService.connected ? (walletService.networkId ?? 'unknown') : undefined
  const formattedNetwork =
    networkLabel === undefined ? undefined : networkLabel.replace(/^canton:/, 'network:')

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-popup',
        'flex flex-col gap-1.5 border-t border-border bg-background/95 px-4 py-2 backdrop-blur-md',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('size-2 rounded-full shrink-0', dotClass)}
        />
        <span
          className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate font-mono text-[0.7rem] tracking-normal"
          title={walletService.reason}
        >
          <span
            className={cn(
              'shrink-0 font-semibold uppercase tracking-[0.06em]',
              walletService.connected ? 'text-success' : 'text-danger',
            )}
          >
            canton
          </span>
          {formattedNetwork !== undefined && (
            <>
              <span className="shrink-0 text-muted-foreground/70">-</span>
              <span
                className="min-w-0 truncate font-medium normal-case text-muted-foreground"
                title={formattedNetwork}
              >
                {formattedNetwork}
              </span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Connection settings"
          title="Connection settings"
          className={cn(ICON_BUTTON_CLASS, 'size-7 rounded-sm text-soft')}
        >
          {COG_ICON}
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="flex min-h-7 items-center gap-2">
        {dapp.kind === 'none' ? (
          <>
            <span className="grid size-6 place-items-center text-muted-foreground">
              {DAPP_EMPTY_ICON}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.88rem] font-semibold text-muted-foreground">
                No Dapp found
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface text-primary">
              {dapp.faviconUrl === undefined ? (
                <span className="font-display text-[0.82rem] font-semibold">
                  {dapp.label.charAt(0).toUpperCase()}
                </span>
              ) : (
                <img
                  className="size-4.5 rounded-sm object-contain"
                  src={dapp.faviconUrl}
                  alt=""
                  aria-hidden="true"
                />
              )}
            </span>
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <div className="truncate text-[0.9rem] font-semibold leading-tight text-foreground">
                {dapp.label}
              </div>
              <div className="shrink-0 truncate text-[0.82rem] font-medium leading-tight text-muted-foreground">
                {dapp.subtitle}
              </div>
            </div>
          </>
        )}
      </div>
    </footer>
  )
}
