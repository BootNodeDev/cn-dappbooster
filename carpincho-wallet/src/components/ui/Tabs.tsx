import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

// Underline-style tab bar (MetaMask-like). The list acts as the view title; content panels scroll
// on their own so the shell chrome (account selector, footer) stays pinned.
export const Tabs = TabsPrimitive.Root

export const TabsList = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}): JSX.Element => (
  <TabsPrimitive.List
    className={cn('flex shrink-0 items-center gap-5 border-b border-border', className)}
  >
    {children}
  </TabsPrimitive.List>
)

export const TabTrigger = ({
  value,
  children,
}: {
  value: string
  children: ReactNode
}): JSX.Element => (
  <TabsPrimitive.Trigger
    value={value}
    className={cn(
      '-mb-px border-b-2 border-transparent px-0.5 pb-2.5 pt-1.5 text-[0.95rem] font-semibold outline-none transition-colors',
      'text-muted-foreground hover:text-foreground focus-visible:text-foreground',
      'data-[state=active]:border-primary data-[state=active]:text-foreground',
    )}
  >
    {children}
  </TabsPrimitive.Trigger>
)

export const TabContent = ({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}): JSX.Element => (
  <TabsPrimitive.Content
    value={value}
    className={className}
  >
    {children}
  </TabsPrimitive.Content>
)
