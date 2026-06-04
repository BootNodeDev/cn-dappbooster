import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/utils/cn'

export const CARD_CLASS = 'bg-surface border border-border rounded-lg p-4 animate-fade-in'

export const Card = ({ className, ...rest }: ComponentPropsWithoutRef<'div'>): JSX.Element => (
  <div
    className={cn(CARD_CLASS, className)}
    {...rest}
  />
)
