import { readFileSync } from 'node:fs'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof globalThis.window === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost:3011' })
}

// Vite replaces __APP_VERSION__ at build time; the node test runner does not,
// so mirror it here from the same root package.json source of truth.
const rootVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version
;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = rootVersion
