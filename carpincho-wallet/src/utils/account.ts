import type { CSSProperties } from 'react'

export const shortMiddle = (value: string, head = 10, tail = 6): string => {
  if (value.length <= head + tail + 1) {
    return value
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const AVATAR_PAIRS = [
  ['#692581', '#a563bf'],
  ['#7d2d99', '#c670e5'],
  ['#b5613a', '#d18a5e'],
  ['#4d4458', '#9a8ea4'],
  ['#3d1349', '#7d2d99'],
  ['#c670e5', '#692581'],
] as const

export const avatarStyle = (partyId: string): CSSProperties => {
  const hash = hashString(partyId)
  const pair = AVATAR_PAIRS[hash % AVATAR_PAIRS.length]
  return {
    background: `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`,
  }
}

export const initials = (name: string): string => name.slice(0, 2).toUpperCase()
