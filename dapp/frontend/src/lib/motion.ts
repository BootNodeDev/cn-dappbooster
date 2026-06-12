import type { Variants } from 'framer-motion'

// Shared motion presets so animations feel consistent across the app.
const EASE = [0.22, 1, 0.36, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
}

export const staggerChildren: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
