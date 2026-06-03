import { useEffect, useRef, useState } from 'react'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { PrimaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { useVault } from '@/vault/useVault'

// Border-tracing comet glow. The path is drawn counter-clockwise starting at
// the bottom-left corner so the comet travels bottom-left -> bottom-right ->
// top-right -> top-left -> back. INSET keeps the stroke off the border-box
// edge, RADIUS matches the label's rounded-sm corners.
const TRACE_INSET = 1.5
const TRACE_RADIUS = 4
// Comet is rendered as N short segments whose opacity falls off toward the
// tail, producing a fading trail that bends around the corners.
const TRACE_SEGMENTS = 18
const TRACE_KEYS = Array.from({ length: TRACE_SEGMENTS }, (_, i) => `trace-seg-${i}`)
// Visible comet length as a fraction of the perimeter.
const TRACE_LEN_FRAC = 0.24
// One lap of travel, then rest for the remainder of the cycle.
const TRACE_ACTIVE_MS = 5000
const TRACE_CYCLE_MS = 10000
// Final fraction of the lap during which the head holds at the bottom-left
// corner while the tail catches up -- the comet is "eaten" by the corner.
const TRACE_EATEN = 0.18
// Peak accent tint mixed into the label background while the comet runs.
const TRACE_TINT = 0.06

const buildTracePath = (w: number, h: number): string => {
  const m = TRACE_INSET
  const r = TRACE_RADIUS
  const x0 = m
  const y0 = m
  const x1 = w - m
  const y1 = h - m
  return [
    `M${x0 + r},${y1}`,
    `L${x1 - r},${y1}`,
    `A${r},${r} 0 0 0 ${x1},${y1 - r}`,
    `L${x1},${y0 + r}`,
    `A${r},${r} 0 0 0 ${x1 - r},${y0}`,
    `L${x0 + r},${y0}`,
    `A${r},${r} 0 0 0 ${x0},${y0 + r}`,
    `L${x0},${y1 - r}`,
    `A${r},${r} 0 0 0 ${x0 + r},${y1}`,
    'Z',
  ].join(' ')
}

export const CreateVault = (): JSX.Element => {
  const v = useVault()
  const ackRef = useRef<HTMLLabelElement>(null)
  const traceGroupRef = useRef<SVGGElement>(null)
  const traceSegRefs = useRef<(SVGPathElement | null)[]>([])
  const [traceSize, setTraceSize] = useState({ w: 0, h: 0 })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [passwordValid, setPasswordValid] = useState(false)

  const canSubmit = passwordValid && acknowledged

  useEffect(() => {
    const el = ackRef.current
    if (!el) return
    const update = (): void => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w === 0 || h === 0) return
      setTraceSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w: traceW, h: traceH } = traceSize
  const tracePath = traceW > 0 ? buildTracePath(traceW, traceH) : ''

  useEffect(() => {
    if (traceW === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const segs = traceSegRefs.current.slice(0, TRACE_SEGMENTS)
    const group = traceGroupRef.current
    const label = ackRef.current
    if (!group || !label || segs.some((s) => !s)) return

    // Exact perimeter of the rounded path: 4 straight runs + 4 quarter arcs.
    const innerW = traceW - 2 * TRACE_INSET - 2 * TRACE_RADIUS
    const innerH = traceH - 2 * TRACE_INSET - 2 * TRACE_RADIUS
    const total = 2 * innerW + 2 * innerH + 2 * Math.PI * TRACE_RADIUS
    const maxLen = total * TRACE_LEN_FRAC
    let start: number | null = null
    let raf = 0

    const frame = (now: number): void => {
      if (start === null) start = now
      const t = (now - start) % TRACE_CYCLE_MS

      if (t > TRACE_ACTIVE_MS) {
        group.style.opacity = '0'
        label.style.backgroundColor = ''
        raf = requestAnimationFrame(frame)
        return
      }
      group.style.opacity = '1'

      const u = t / TRACE_ACTIVE_MS
      // Accent tint envelope: fade in, hold, fade out across the lap.
      const tintEnv = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1
      const tintPct = (tintEnv * TRACE_TINT * 100).toFixed(2)
      label.style.backgroundColor = `color-mix(in srgb, var(--color-accent) ${tintPct}%, var(--color-muted))`
      // Head leads at constant speed, then holds at the bottom-left corner
      // (length = total) for the final TRACE_EATEN slice of the lap.
      const head = Math.min(u / (1 - TRACE_EATEN), 1) * total
      // Tail is pinned at the start corner while the comet grows, trails by
      // maxLen during the cruise, then collapses into the corner at the end.
      const tail =
        u < 1 - TRACE_EATEN
          ? Math.max(0, head - maxLen)
          : total - maxLen + ((u - (1 - TRACE_EATEN)) / TRACE_EATEN) * maxLen
      const len = head - tail

      for (let i = 0; i < TRACE_SEGMENTS; i++) {
        const seg = segs[i]
        if (!seg) continue
        const a = tail + (len * i) / TRACE_SEGMENTS
        const b = tail + (len * (i + 1)) / TRACE_SEGMENTS
        seg.style.strokeDasharray = `${Math.max(0, b - a)} ${total}`
        seg.style.strokeDashoffset = `${-a}`
        // Fade from the bright head (i = last) down to the faint tail (i = 0).
        seg.style.opacity = `${((i + 1) / TRACE_SEGMENTS) ** 1.7}`
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [traceW, traceH])

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setIsWorking(true)
    try {
      await v.setup(password)
    } catch (err) {
      toast.error(`Vault setup failed: ${(err as Error).message}`)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Card className="mb-3">
      <p className="text-soft text-[1rem] mb-5 leading-relaxed flex items-center gap-2">
        Choose a strong password
        <Tooltip
          content={
            <>
              Your password encrypts your private keys locally with{' '}
              <span className="font-mono">AES-GCM</span>. It never leaves this device and{' '}
              <b>cannot be recovered</b>.
            </>
          }
          label="What is the password for?"
        />
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <NewPasswordFields
          confirm={confirm}
          confirmLabel="Confirm password"
          confirmTestId="setup-confirm"
          labelMode="visible"
          onConfirmChange={setConfirm}
          onPasswordChange={setPassword}
          onValidityChange={setPasswordValid}
          password={password}
          passwordLabel="Password"
          passwordTestId="setup-password"
        />
        <label
          ref={ackRef}
          className="border-trace flex items-start gap-2.5 rounded-sm border border-border bg-muted p-2 text-[0.85rem] leading-snug text-soft cursor-pointer"
          htmlFor="ack"
        >
          {tracePath && (
            <svg
              aria-hidden="true"
              className="border-trace-svg"
              viewBox={`0 0 ${traceW} ${traceH}`}
              preserveAspectRatio="none"
            >
              <g
                ref={traceGroupRef}
                className="border-trace-glow"
                style={{ opacity: 0 }}
              >
                {TRACE_KEYS.map((key, i) => (
                  <path
                    key={key}
                    ref={(el) => {
                      traceSegRefs.current[i] = el
                    }}
                    className="border-trace-seg"
                    d={tracePath}
                    style={{ strokeDasharray: '0 99999' }}
                  />
                ))}
              </g>
            </svg>
          )}
          <input
            id="ack"
            type="checkbox"
            checked={acknowledged}
            data-testid="setup-accept-warning"
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 shrink-0 accent-primary"
          />
          <span>
            I understand that if I lose my password, <b>it can't be recovered</b>.
          </span>
        </label>
        <PrimaryButton
          className="w-full mt-10"
          data-testid="setup-create-vault"
          disabled={isWorking || !canSubmit}
          type="submit"
        >
          {isWorking ? 'Encrypting...' : 'Create'}
        </PrimaryButton>
      </form>
    </Card>
  )
}
