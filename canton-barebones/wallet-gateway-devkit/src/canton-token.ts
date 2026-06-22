import crypto from 'node:crypto'

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

export interface CantonTokenInputs {
  subject: string
  audience: string
  secret: string
}

export const createCantonToken = ({ subject, audience, secret }: CantonTokenInputs): string => {
  if (!subject) throw new Error('subject is required')
  if (!audience) throw new Error('audience is required')
  if (!secret) throw new Error('CANTON_AUTH_SECRET is required')

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: subject, aud: audience }
  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${b64url(signature)}`
}
