import { type ComponentPropsWithoutRef, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export const CARD_CLASS = 'bg-surface border border-border rounded-lg p-4 animate-fade-in'

export const Card = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn(CARD_CLASS, className)} {...rest} />
  ),
)
Card.displayName = 'Card'
