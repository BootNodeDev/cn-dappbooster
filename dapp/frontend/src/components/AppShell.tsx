import { Outlet, useRouterState } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { loadRuntimeConfig } from '@/runtimeConfig'

// No Venue link by design: the operator view lives at /venue and is reached by
// typing the URL. On the real ledger only the venue party can see its data.
export const AppShell = (): JSX.Element => {
  const config = loadRuntimeConfig()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end border-b border-border pb-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {config.cantonNetwork}
        </span>
      </div>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.6, 0.2, 1] }}
      >
        <Outlet />
      </motion.div>
    </div>
  )
}
