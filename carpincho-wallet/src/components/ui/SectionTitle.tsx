import type { ReactNode } from 'react'
import { cn } from '@/utils/cn.ts'

interface SectionTitleProps {
  children: ReactNode
  className?: string
}

const BASE_CLASS =
  'm-0 font-display text-[1.25rem] font-semibold tracking-[-0.012em] text-foreground leading-tight'

export const SectionTitle = ({ children, className }: SectionTitleProps): JSX.Element => (
  <h5 className={cn(BASE_CLASS, className)}>{children}</h5>
)
