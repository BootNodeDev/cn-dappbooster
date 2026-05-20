#!/usr/bin/env node
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { DevSupervisor, fail, log, parseEnvFile, repoRoot } from './lib/run.mjs'

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

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen({ port, host: '127.0.0.1', exclusive: true })
  })

const requirePortsFree = async () => {
  const busy = []
  for (const entry of DEV_PORTS) {
    if (!(await isPortFree(entry.port))) {
      busy.push(entry)
    }
  }
  if (busy.length === 0) {
    return
  }
  const detail = busy.map((entry) => `${entry.port} (${entry.label})`).join(', ')
  fail(`port(s) already in use: ${detail}. Stop the previous dev process or free the port and retry.`)
}

const main = async () => {
  log('preflight checks (mock mode)')
  requireWalletProjectId()
  await requirePortsFree()
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
