import { JsonView as RjvJsonView } from '@uiw/react-json-view'
import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

// Map the json tree's CSS variables onto the wallet's existing token palette.
const THEME_STYLE: CSSProperties = {
  '--w-rjv-font-family': 'var(--font-mono)',
  '--w-rjv-background-color': 'transparent',
  '--w-rjv-color': 'var(--color-foreground)',
  '--w-rjv-key-string': 'var(--color-accent)',
  '--w-rjv-line-color': 'var(--color-border)',
  '--w-rjv-arrow-color': 'var(--color-muted-foreground)',
  '--w-rjv-info-color': 'var(--color-muted-foreground)',
  '--w-rjv-brackets-color': 'var(--color-muted-foreground)',
  '--w-rjv-type-string-color': 'var(--color-success)',
  '--w-rjv-type-int-color': 'var(--color-primary)',
  '--w-rjv-type-float-color': 'var(--color-primary)',
  '--w-rjv-type-boolean-color': 'var(--color-warning)',
  '--w-rjv-type-null-color': 'var(--color-danger)',
} as CSSProperties

interface JsonViewProps {
  value: unknown
  className?: string
}

// Read-only JSON tree with per-node copy; used for contract args, results, and tx payloads.
export const JsonView = ({ value, className }: JsonViewProps): JSX.Element => (
  <div
    className={cn(
      'max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.78rem] leading-relaxed',
      className,
    )}
  >
    <RjvJsonView
      value={value as object}
      style={THEME_STYLE}
      displayDataTypes={false}
      displayObjectSize={false}
      enableClipboard
      collapsed={2}
    />
  </div>
)
