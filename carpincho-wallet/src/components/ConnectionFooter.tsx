import { ICON_BUTTON_CLASS, SecondaryButton } from '@/components/ui/Button'
import { COG_ICON, DISCONNECT_ICON } from '@/components/ui/icons'
import { cn } from '@/utils/cn'

export interface WalletServiceFooterStatus {
  connected: boolean
  networkId?: string
  reason?: string
}

export type DappFooterStatus =
  | { kind: 'none' }
  | { kind: 'detected' | 'connected'; label: string; subtitle: string }

interface ConnectionFooterProps {
  walletService: WalletServiceFooterStatus
  dapp: DappFooterStatus
  dappAccountAddress?: string
  onDisconnectDapp?: () => void
  onOpenSettings: () => void
}

// Shows Canton service health, plus a connected-dApp row (app + account address + disconnect) that
// only appears while a dApp is actually connected.
export const ConnectionFooter = ({
  walletService,
  dapp,
  dappAccountAddress,
  onDisconnectDapp,
  onOpenSettings,
}: ConnectionFooterProps): JSX.Element => {
  const dotClass = walletService.connected ? 'bg-success' : 'bg-danger'
  const networkLabel = walletService.connected ? (walletService.networkId ?? 'unknown') : undefined
  const formattedNetwork =
    networkLabel === undefined ? undefined : networkLabel.replace(/^canton:/, 'network:')

  return (
    <footer
      className={cn(
        // In-flow at the bottom of the home column, bled to the popup edges past the shell padding.
        '-mx-3 shrink-0',
        'flex flex-col gap-1.5 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-md',
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

      {dapp.kind === 'connected' && (
        <>
          <div className="-mx-2 h-px bg-border" />

          <div className="flex min-h-7 items-center gap-2">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[0.82rem] font-semibold text-foreground">
                {dapp.label}
              </div>
              {dappAccountAddress !== undefined && (
                <div className="truncate font-mono text-[0.78rem] text-muted-foreground">
                  {dappAccountAddress}
                </div>
              )}
            </div>
            {onDisconnectDapp !== undefined && (
              <SecondaryButton
                className="shrink-0 px-2.5 py-2"
                onClick={onDisconnectDapp}
                aria-label="Disconnect"
                title="Disconnect"
              >
                {DISCONNECT_ICON}
              </SecondaryButton>
            )}
          </div>
        </>
      )}
    </footer>
  )
}
