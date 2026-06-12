// crypto.randomUUID() requires a secure context (HTTPS or localhost). On a plain-HTTP
// non-localhost origin (e.g. LAN access to the dev server) it is undefined and throws,
// which would break command submission. Fall back to a best-effort v4-shaped id.
export const uuid = (): string => {
  const c = globalThis.crypto as Crypto | undefined
  if (c !== undefined && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  if (c !== undefined && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
  }
  return `${Date.now().toString(16)}-${Math.floor(Math.random() * 0xffffffff).toString(16)}`
}
