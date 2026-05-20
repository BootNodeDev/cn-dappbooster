#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { DevSupervisor, fail, log, parseEnvFile, repoRoot, requirePortsFree } from './lib/run.mjs'

const WALLET_DOTENV = path.join(repoRoot, 'carpincho-wallet/.env.local')
const DEV_PORTS = [
  { port: 3010, label: 'wallet-service' },
  { port: 3011, label: 'carpincho-wallet' }
]

const requireWalletProjectId = () => {
  if (!existsSync(WALLET_DOTENV)) {
    fail(`missing ${WALLET_DOTENV}. Copy carpincho-wallet/.env.local.example and set VITE_WC_PROJECT_ID.`)
  }
  const env = parseEnvFile(WALLET_DOTENV)
  if (env.VITE_WC_PROJECT_ID === undefined || env.VITE_WC_PROJECT_ID === '') {
    fail(`carpincho-wallet: VITE_WC_PROJECT_ID is empty in ${WALLET_DOTENV}. Get one from https://cloud.reown.com.`)
  }
}

const main = async () => {
  log('preflight checks (mock mode)')
  requireWalletProjectId()
  await requirePortsFree(DEV_PORTS)
  log('preflight ok')

  log('starting wallet-service in MOCK mode + carpincho-wallet. Ctrl-C to stop.')
  log('endpoints: http://localhost:3010/health | http://localhost:3011')
  const supervisor = new DevSupervisor()
  supervisor.spawn('wallet-service:mock', 'npm', ['run', 'wallet-service:dev'], {
    env: { WALLET_SERVICE_MOCK: '1' }
  })
  supervisor.spawn('wallet', 'npm', ['run', 'wallet:dev'])
  await supervisor.waitForExit()
}

main().catch((error) => {
  fail(error.stack ?? error.message ?? String(error))
})
