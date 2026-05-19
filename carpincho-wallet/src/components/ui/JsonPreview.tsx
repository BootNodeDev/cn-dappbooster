import type { ReactNode } from 'react'
import { cn } from '@/utils/cn.ts'

interface JsonPreviewProps {
  children: ReactNode
  className?: string
}

export const JsonPreview = ({ children, className }: JsonPreviewProps): JSX.Element => (
  <pre
    className={cn(
      'font-mono text-[0.82rem] leading-relaxed mt-3 max-h-[240px] overflow-auto text-soft break-words whitespace-pre-wrap',
      'bg-background/60 border border-border rounded-md p-3',
      className,
    )}
  >
    {children}
  </pre>
)
