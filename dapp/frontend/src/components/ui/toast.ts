import type { ReactNode } from 'react'

export type ToastVariant = 'info' | 'error' | 'warning' | 'success'

export interface ToastEntry {
  id: string
  variant: ToastVariant
  message: ReactNode
  durationMs: number
}

export interface ToastInput {
  message: ReactNode
  durationMs?: number
}

type Listener = (entries: ReadonlyArray<ToastEntry>) => void

const MAX_VISIBLE = 3

// Only errors persist until dismissed; everything else clears after 3 s.
const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  info: 3000,
  success: 3000,
  warning: 3000,
  error: Number.POSITIVE_INFINITY,
}

export const NEVER_DISMISS_MS = 2_147_483_647

export const resolveDurationMs = (durationMs: number): number =>
  Number.isFinite(durationMs) ? durationMs : NEVER_DISMISS_MS

let entries: ReadonlyArray<ToastEntry> = []
const listeners = new Set<Listener>()

const nextId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

const notify = (): void => {
  for (const listener of listeners) listener(entries)
}

const emit = (variant: ToastVariant, input: ToastInput | string): string => {
  const normalized: ToastInput = typeof input === 'string' ? { message: input } : input
  const entry: ToastEntry = {
    id: nextId(),
    variant,
    message: normalized.message,
    durationMs: normalized.durationMs ?? DEFAULT_DURATION_MS[variant],
  }
  // Collapse exact duplicates: same variant + identical string message replaces the existing
  // toast (restarting its timer via the fresh id). ReactNode messages are always distinct.
  const isDuplicate = (existing: ToastEntry): boolean =>
    existing.variant === variant &&
    typeof existing.message === 'string' &&
    typeof entry.message === 'string' &&
    existing.message === entry.message
  const withoutDuplicate = entries.filter((existing) => !isDuplicate(existing))
  const next = [...withoutDuplicate, entry]
  // Cap only the auto-dismissing toasts; persistent ones (errors) stay until the
  // user dismisses them, so a burst of transient toasts can't silently evict them.
  const transient = next.filter((existing) => Number.isFinite(existing.durationMs))
  const overflow = transient.length - MAX_VISIBLE
  if (overflow > 0) {
    const dropped = new Set(transient.slice(0, overflow))
    entries = next.filter((existing) => !dropped.has(existing))
  } else {
    entries = next
  }
  notify()
  return entry.id
}

const dismiss = (id: string): void => {
  const next = entries.filter((entry) => entry.id !== id)
  if (next.length === entries.length) return
  entries = next
  notify()
}

export const subscribeToasts = (listener: Listener): (() => void) => {
  listeners.add(listener)
  listener(entries)
  return () => {
    listeners.delete(listener)
  }
}

export const toast = {
  info: (input: ToastInput | string): string => emit('info', input),
  success: (input: ToastInput | string): string => emit('success', input),
  warning: (input: ToastInput | string): string => emit('warning', input),
  error: (input: ToastInput | string): string => emit('error', input),
  dismiss,
}
