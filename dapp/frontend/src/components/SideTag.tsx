import type { Side } from '@/darkpool/types'

// Buy/sell marker: up/down color paired with an arrow glyph (never color alone).
export const SideTag = ({
  side,
  iconOnly = false,
}: {
  side: Side
  iconOnly?: boolean
}): JSX.Element => {
  const isBuy = side === 'Buy'
  return (
    <span className={`font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
      <span aria-hidden="true">{isBuy ? '▲' : '▼'}</span>
      {iconOnly ? <span className="sr-only">{side}</span> : ` ${side}`}
    </span>
  )
}
