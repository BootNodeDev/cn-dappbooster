import { shortenParty } from '@/lib/format'
import { useParties } from '@/wallet/hooks'

export const Footer = (): React.JSX.Element => {
  const { operator } = useParties()
  return (
    <footer className="border-t border-border bg-surface/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-fg-muted sm:px-8">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" />
          Canton · direct ledger
        </div>
        {operator !== '' && (
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-[0.08em]">Factory owner</span>
            <span className="truncate font-mono text-fg-soft">{shortenParty(operator)}</span>
          </div>
        )}
      </div>
    </footer>
  )
}
