// Composition root: config → token provider → ledger (mock or HTTP) →
// projection → scheduler → app context. Kept separate from server.ts so tests
// can build a context without starting the listener.
import { m2mToken, noToken, staticToken, type TokenProvider } from './auth.ts'
import type { Config } from './config.ts'
import type { AppContext } from './http.ts'
import { createHttpLedger, type Ledger } from './ledger.ts'
import { createMockLedger } from './mockLedger.ts'
import { createProjection } from './projection.ts'
import { createScheduler } from './scheduler.ts'

const tokenProvider = (config: Config): TokenProvider => {
  if (config.auth.source === 'static') {
    return staticToken(config.auth.staticToken ?? '')
  }
  if (config.auth.source === 'm2m' && config.auth.m2m !== undefined) {
    return m2mToken(config.auth.m2m)
  }
  return noToken()
}

const buildLedger = (config: Config): Ledger =>
  config.mock
    ? createMockLedger(config)
    : createHttpLedger(config.jsonApiUrl, tokenProvider(config))

export const buildContext = (config: Config): AppContext => {
  const ledger = buildLedger(config)
  const projection = createProjection(ledger, config)
  const scheduler = createScheduler({
    ledger,
    projection,
    venue: config.parties.venue,
    poolId: config.poolId,
    poolCid: config.poolCid,
    factoryCid: config.factoryCid,
    intervalMs: config.matchIntervalMs,
  })
  return { config, ledger, projection, scheduler }
}
