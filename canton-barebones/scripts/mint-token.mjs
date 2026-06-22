#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// This script creates a LocalNet-compatible JWT for humans or other scripts.
// It reads wallet-gateway-devkit env defaults first, then lets shell env win.

// Encodes JWT segments in the URL-safe base64 variant required by bearer tokens.
const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

// Reads local .env values so token generation follows the same config as the stack.
const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .flatMap((line) => {
        const separator = line.indexOf('=')
        if (separator === -1) {
          return []
        }
        const key = line.slice(0, separator).trim()
        const rawValue = line.slice(separator + 1).trim()
        const value =
          (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue
        return [[key, value]]
      }),
  )
}

export const createCantonToken = ({ subject, audience, secret }) => {
  if (subject === undefined || subject === '') {
    throw new Error('subject is required')
  }
  if (audience === undefined || audience === '') {
    throw new Error('audience is required')
  }
  if (secret === undefined || secret === '') {
    throw new Error('AUTH_SECRET is required')
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: subject, aud: audience }
  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${b64url(signature)}`
}

// Prints a LocalNet token for static-token mode or emits only the raw token for scripts.
const main = () => {
  // Step 1: merge checked-in service defaults with caller-provided overrides.
  const env = {
    ...parseEnvFile(path.join(root, 'env/.env.wallet-gateway-devkit')),
    ...process.env,
  }
  // Step 2: support raw output for scripts and pretty instructions for humans.
  const args = process.argv.slice(2)
  const raw = args[0] === '--raw'
  const subject = (raw ? args[1] : args[0]) ?? env.AUTH_SUBJECT ?? 'ledger-api-user'
  // Step 3: sign the token with the same audience and secret used by devkit.
  const token = createCantonToken({
    subject,
    audience: env.AUTH_AUDIENCE,
    secret: env.AUTH_SECRET,
  })
  // Step 4: keep machine-readable mode to exactly one token line.
  if (raw) {
    process.stdout.write(`${token}\n`)
    return
  }
  // Step 5: print copy-paste instructions for manual static-token workflows.
  process.stdout.write(`${token}\n\n`)
  process.stdout.write('For wallet-gateway-devkit static-token auth:\n')
  process.stdout.write('  Set AUTH_MODE=static-token in env/.env.wallet-gateway-devkit.\n')
  process.stdout.write(`  AUTH_TOKEN=${token}\n\n`)
  process.stdout.write('For Carpincho LocalNet settings:\n')
  process.stdout.write('  Use this token as the LocalNet bearer token.\n')
  process.stdout.write(
    '  You may reuse it for local dev or generate another token with this script.\n',
  )
}

// Run the CLI only when the file is executed directly; tests import helpers.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
