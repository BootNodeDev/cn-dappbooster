import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, CopyIcon, LogoutIcon } from '@/components/icons'
import { toast } from '@/components/toast'
import { partyHint, shortenParty } from '@/lib/format'
import { useConnect, useParty } from '@/wallet/hooks'
import { writeReconnect } from '@/wallet/reconnect'

// Connected-account control. The pill shows the connected external (Carpincho)
// party; the menu copies the full party id and disconnects. There is no party
// switching — the single connected wallet party is the only identity.
export const AccountMenu = (): React.JSX.Element | null => {
  const { party } = useParty()
  const { disconnect } = useConnect()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (party === undefined) {
    return null
  }

  const partyId = party.partyId

  const copyId = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(partyId)
      toast.success('Party id copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setOpen(false)
    writeReconnect(null)
    await disconnect()
    toast.success('Wallet disconnected')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        data-testid="connected-party"
        data-party-id={partyId}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-fg transition-colors hover:border-primary"
      >
        <span className="size-6 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
        <span className="truncate font-mono text-xs">{partyHint(partyId)}</span>
        <ChevronDownIcon width={15} height={15} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-popover)]">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-fg-muted">
            Connected party
          </span>
          <div className="mt-1 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted p-2 font-mono text-xs text-fg">
              {shortenParty(partyId)}
            </code>
            <button
              type="button"
              aria-label="Copy party id"
              onClick={() => void copyId()}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary"
            >
              <CopyIcon width={15} height={15} />
            </button>
          </div>
          <button
            type="button"
            data-testid="logout"
            onClick={() => void onDisconnect()}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <LogoutIcon width={15} height={15} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
