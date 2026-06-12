import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'

// Border-tracing comet glow. Path runs counter-clockwise from the bottom-left
// corner; INSET keeps the stroke off the edge, RADIUS matches rounded-sm corners.
const TRACE_INSET = 1.5
const TRACE_RADIUS = 4
// Comet is N short segments whose opacity falls off toward the tail (fading trail).
const TRACE_SEGMENTS = 18
const TRACE_KEYS = Array.from({ length: TRACE_SEGMENTS }, (_, i) => `trace-seg-${i}`)
// Visible comet length as a fraction of the perimeter.
const TRACE_LEN_FRAC = 0.24
// One lap of travel, then rest for the remainder of the cycle.
const TRACE_ACTIVE_MS = 5000
const TRACE_CYCLE_MS = 10000
// Hold before the very first lap, so the comet eases in rather than firing on mount.
const TRACE_START_DELAY_MS = 10000
// Final fraction of the lap where the head holds at the corner and the tail
// catches up -- the comet is "eaten" by the corner.
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

// Animates a fading comet around the border of `containerRef` and tints its background.
// Once `held` is true the comet finishes its lap, stops looping, and the tint stays on.
export const useBorderTrace = (
  held: boolean,
): { containerRef: RefObject<HTMLLabelElement | null>; overlay: ReactNode } => {
  const containerRef = useRef<HTMLLabelElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const segRefs = useRef<(SVGPathElement | null)[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Lets the animation loop read the latest `held` value without restarting.
  const heldRef = useRef(held)
  heldRef.current = held

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (): void => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w === 0 || h === 0) return
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const tracePath = w > 0 ? buildTracePath(w, h) : ''

  useEffect(() => {
    if (w === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const segs = segRefs.current
    const group = groupRef.current
    const label = containerRef.current
    if (!group || !label || segs.some((s) => !s)) return

    // Exact perimeter of the rounded path: 4 straight runs + 4 quarter arcs.
    const innerW = w - 2 * TRACE_INSET - 2 * TRACE_RADIUS
    const innerH = h - 2 * TRACE_INSET - 2 * TRACE_RADIUS
    const total = 2 * innerW + 2 * innerH + 2 * Math.PI * TRACE_RADIUS
    const maxLen = total * TRACE_LEN_FRAC

    let lapStart: number | null = null
    let raf = 0
    // Tint level (0..1) eased toward target; last-written values let idle frames
    // skip redundant style writes.
    let tintLevel = 0
    let lastBg: string | null = null
    let lastGroupOpacity: string | null = null

    const setBg = (level: number): void => {
      const bg =
        level <= 0.002
          ? ''
          : `color-mix(in srgb, var(--color-accent) ${(level * TRACE_TINT * 100).toFixed(2)}%, var(--color-muted))`
      if (bg === lastBg) return
      label.style.backgroundColor = bg
      lastBg = bg
    }
    const setGroupOpacity = (op: string): void => {
      if (op === lastGroupOpacity) return
      group.style.opacity = op
      lastGroupOpacity = op
    }

    const frame = (now: number): void => {
      const ack = heldRef.current
      if (lapStart === null) lapStart = now + TRACE_START_DELAY_MS
      const elapsed = now - lapStart

      if (elapsed < 0 || elapsed >= TRACE_ACTIVE_MS) {
        // Idle: comet hidden. Ease tint toward peak (held) or zero, then settle.
        // Start the next lap only when not held and the rest is up.
        setGroupOpacity('0')
        const target = ack ? 1 : 0
        tintLevel += (target - tintLevel) * 0.15
        if (Math.abs(target - tintLevel) < 0.004) tintLevel = target
        setBg(tintLevel)
        if (!ack && elapsed >= TRACE_CYCLE_MS) lapStart = now
        raf = requestAnimationFrame(frame)
        return
      }
      setGroupOpacity('1')

      const u = elapsed / TRACE_ACTIVE_MS
      // Tint envelope: fade in, hold, fade out across the lap; held at peak once checked.
      tintLevel = ack ? 1 : u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1
      setBg(tintLevel)
      // Head leads at constant speed, then holds at the corner for the final TRACE_EATEN slice.
      const head = Math.min(u / (1 - TRACE_EATEN), 1) * total
      // Tail: pinned while growing, trails by maxLen during cruise, then collapses into the corner.
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
        // Bright head (i = last) down to faint tail (i = 0).
        seg.style.opacity = `${((i + 1) / TRACE_SEGMENTS) ** 1.7}`
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [w, h])

  const overlay = tracePath ? (
    <svg
      aria-hidden="true"
      className="border-trace-svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <g
        ref={groupRef}
        className="border-trace-glow"
        style={{ opacity: 0 }}
      >
        {TRACE_KEYS.map((key, i) => (
          <path
            key={key}
            ref={(el) => {
              segRefs.current[i] = el
            }}
            className="border-trace-seg"
            d={tracePath}
          />
        ))}
      </g>
    </svg>
  ) : null

  return { containerRef, overlay }
}
