import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, CopyIcon, LogoutIcon } from '@/components/icons'
import { toast } from '@/components/toast'
import { cn } from '@/lib/cn'
import { partyHint } from '@/lib/format'
import { useConnect, useParties, useParty } from '@/wallet/hooks'

// Party switcher. Pill shows the acting party hint + chevron. The menu lists every
// party in the pool (the acting one highlighted), copies any id, and signs out.
export const WalletControl = (): React.JSX.Element | null => {
  const { connect, disconnect } = useConnect()
  const { party } = useParty()
  const { pool } = useParties()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onDown = (e: PointerEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (party === undefined) {
    return null
  }

  const copyId = async (id: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('Party id copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-fg transition-colors hover:border-primary"
      >
        <span className="size-6 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
        <span className="truncate font-mono text-xs">{partyHint(party.partyId)}</span>
        <ChevronDownIcon width={15} height={15} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-popover)]">
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {pool.map((candidate) => {
              const selected = candidate.partyId === party.partyId
              return (
                <li
                  key={candidate.partyId}
                  className={cn(
                    'flex items-stretch rounded-lg pr-1 transition-colors',
                    selected ? 'bg-primary-soft' : 'hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    disabled={selected}
                    aria-current={selected}
                    onClick={() => {
                      connect(candidate)
                      setOpen(false)
                      toast.success(`Acting as ${candidate.name}`)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                  >
                    <span className="size-7 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                      {candidate.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Copy ${candidate.name} party id`}
                    title={`Copy ${candidate.name} party id`}
                    onClick={() => void copyId(candidate.partyId)}
                    className="shrink-0 self-center px-2 text-fg-muted transition-colors hover:text-primary"
                  >
                    <CopyIcon width={14} height={14} />
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              disconnect()
              toast.success('Signed out')
            }}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <LogoutIcon width={15} height={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
