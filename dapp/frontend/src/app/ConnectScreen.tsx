import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/components/icons'
import { useConnect, useParties } from '@/wallet/hooks'
import { ThemeToggle } from './ThemeToggle'

// Landing party picker. Picking a party enters the app. The party is remembered
// in localStorage so a reload lands back in the same session.

export const ConnectScreen = (): React.JSX.Element => {
  const { connect } = useConnect()
  const { pool, operator } = useParties()
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-xl shadow-[var(--glow)]" />
          <span className="text-base font-extrabold tracking-tight text-fg">
            Canton Coin Vesting
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <img
          src="/favicon.svg"
          alt=""
          className="mb-8 size-24 rounded-[1.75rem] shadow-[var(--glow)]"
        />
        <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-5xl">
          Canton Coin Vesting
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-fg-muted">
          Watch the escrows vesting to you unlock over time, claim whatever is ready whenever you
          like, and set up new escrows for the people you want to reward. Every claim settles as a
          real transaction on the Canton ledger.
        </p>

        <div className="mt-9 w-full max-w-md">
          {pool.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-fg-muted">
              No parties available. Run the vest-lite bootstrap to populate the pool.
            </div>
          ) : (
            <div className="relative" ref={ref}>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary"
              >
                <span className="text-fg-muted">Select a party</span>
                <ChevronDownIcon width={16} height={16} className="text-fg-muted" />
              </button>
              {open && (
                <ul className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-popover)]">
                  {pool.map((party) => (
                    <li key={party.partyId}>
                      <button
                        type="button"
                        onClick={() => connect(party)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <span className="size-7 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold text-fg">{party.name}</span>
                          <span className="font-mono text-xs text-fg-muted">
                            {party.partyId === operator ? 'Manager' : 'Beneficiary'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
