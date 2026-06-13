import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

export const Stat = ({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}): JSX.Element => {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const spring = useSpring(value, { stiffness: 90, damping: 18 })
  const text = useTransform(spring, (n) => format(n))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  if (reduced) return <span className={className}>{format(value)}</span>
  return <motion.span className={className}>{text}</motion.span>
}
