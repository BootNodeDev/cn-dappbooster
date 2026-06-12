#!/usr/bin/env node
// One-off: upload the amulet-vesting DAR to the LocalNet participant via the
// JSON Ledger API v2, using the same unsafe HMAC token scheme as the bootstrap.
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const JSON_API = 'http://localhost:3975'
const HMAC_SECRET = 'unsafe'
const __dir = dirname(fileURLToPath(import.meta.url))
const DAR = resolve(__dir, '../dapp/daml/amulet-vesting/.daml/dist/amulet-vesting-0.0.2.dar')

const b64 = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (sub) => {
  const h = b64(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const p = b64(Buffer.from(JSON.stringify({ sub, aud: 'https://canton.network.global', exp: 9999999999 })))
  const s = b64(createHmac('sha256', HMAC_SECRET).update(`${h}.${p}`).digest())
  return `${h}.${p}.${s}`
}

const dar = readFileSync(DAR)
const res = await fetch(`${JSON_API}/v2/packages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${token('ledger-api-user')}` },
  body: dar,
})
console.log('status', res.status)
console.log(await res.text())
