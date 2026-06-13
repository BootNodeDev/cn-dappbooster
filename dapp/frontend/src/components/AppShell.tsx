import { Outlet, useRouterState } from '@tanstack/react-router'
import { motion } from 'framer-motion'

// No nav and no header chrome here: ConnectionBar owns the brand, theme toggle,
// wallet account dropdown (which shows the network), and the welcome/lock states.
// The operator view lives at /venue and is reached by typing the URL.
export const AppShell = (): JSX.Element => {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.6, 0.2, 1] }}
    >
      <Outlet />
    </motion.div>
  )
}
