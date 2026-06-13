import { Link, Outlet } from '@tanstack/react-router'
import { loadRuntimeConfig } from '@/runtimeConfig'

const navBase =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground'
const navActive =
  'rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground bg-surface border border-border'

export const AppShell = (): JSX.Element => {
  const config = loadRuntimeConfig()
  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-1">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className={navBase}
            activeProps={{ className: navActive }}
          >
            Trade
          </Link>
          <Link to="/venue" className={navBase} activeProps={{ className: navActive }}>
            Venue
          </Link>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {config.cantonNetwork}
        </span>
      </nav>
      <Outlet />
    </div>
  )
}
