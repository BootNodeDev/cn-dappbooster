#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DevSupervisor, captureStep, fail, log, parseEnvFile, repoRoot, requirePortsFree, runStep } from './lib/run.mjs'

const COUNTER_DAR = path.join(repoRoot, 'counter/daml/.daml/dist/quickstart-counter-0.0.1.dar')
const WALLET_SERVICE_ENV = path.join(repoRoot, 'counter/wallet-service/.env')
const WALLET_SERVICE_ENV_EXAMPLE = path.join(repoRoot, 'counter/wallet-service/.env.example')
const WALLET_DOTENV = path.join(repoRoot, 'carpincho-wallet/.env.local')
const APP_DOTENV = path.join(repoRoot, 'counter/frontend/.env.local')
const DEV_PORTS = [
  { port: 3010, label: 'wallet-service' },
  { port: 3011, label: 'carpincho-wallet' },
  { port: 3012, label: 'counter/frontend' }
]
const HEALTH_URL = 'http://127.0.0.1:3016/health'
const WALLET_SERVICE_HEALTH = 'http://127.0.0.1:3010/health'
const WALLET_DEV = 'http://127.0.0.1:3011'
const APP_DEV = 'http://127.0.0.1:3012'
const HEALTH_TIMEOUT_MS = 180_000
const POLL_INTERVAL_MS = 2_000
const TOKEN_PLACEHOLDER = 'replace-with-canton-scaffold-token'

const requireEnvFileWithViteProjectId = (filePath, owner) => {
  if (!existsSync(filePath)) {
    fail(`missing ${owner} dotenv at ${filePath}. Copy the .env.local.example and set VITE_WC_PROJECT_ID.`)
  }
  const env = parseEnvFile(filePath)
  if (env.VITE_WC_PROJECT_ID === undefined || env.VITE_WC_PROJECT_ID === '') {
    fail(`${owner}: VITE_WC_PROJECT_ID is empty in ${filePath}. Get a project id from https://cloud.reown.com.`)
  }
}

const requireDocker = async () => {
  try {
    await captureStep('docker', 'docker', ['info'])
  } catch (error) {
    fail(`docker is not reachable. Start Docker Desktop or the docker daemon. (${error.message.split('\n')[0]})`)
  }
}

const requireDamlToolchain = async () => {
  try {
    await captureStep('dpm', 'dpm', ['--version'])
  } catch {
    fail('dpm is missing. Install the Daml Project Manager (dpm). counter/daml uses `dpm build`.')
  }
}

const isCantonHealthy = async () => {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) {
      return false
    }
    const body = await response.text()
    return body.includes('connected-synchronizer : Ok()')
  } catch {
    return false
  }
}

const waitForHealth = async () => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isCantonHealthy()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  fail(`canton failed to report healthy on ${HEALTH_URL} within ${HEALTH_TIMEOUT_MS / 1000}s. Inspect with: docker compose -f canton-base/docker-compose.yaml logs canton`)
}

const ensureCantonUp = async () => {
  if (await isCantonHealthy()) {
    log('canton: already healthy, skipping canton:up')
    return
  }
  log('canton: not healthy, running canton:up')
  await runStep('canton:up', 'npm', ['run', 'canton:up'])
  log('canton: polling health endpoint')
  await waitForHealth()
}

const ensureDarBuilt = async () => {
  if (existsSync(COUNTER_DAR)) {
    log(`counter: DAR present at ${path.relative(repoRoot, COUNTER_DAR)}, skipping build`)
    return
  }
  log('counter: building DAR')
  await runStep('counter:build-dar', 'npm', ['run', 'counter:build-dar'])
  if (!existsSync(COUNTER_DAR)) {
    fail(`counter: build did not produce ${COUNTER_DAR}`)
  }
}

const ensureDarDeployed = async () => {
  log('counter: deploying DAR (idempotent in Canton, no-op if already uploaded)')
  await runStep('counter:deploy-dar', 'npm', ['run', 'counter:deploy-dar'])
}

const ensureWalletServiceDotenv = () => {
  if (existsSync(WALLET_SERVICE_ENV)) {
    return
  }
  if (!existsSync(WALLET_SERVICE_ENV_EXAMPLE)) {
    fail(`missing both ${WALLET_SERVICE_ENV} and ${WALLET_SERVICE_ENV_EXAMPLE}. Restore the example or create the .env manually.`)
  }
  copyFileSync(WALLET_SERVICE_ENV_EXAMPLE, WALLET_SERVICE_ENV)
  log(`wallet-service: created ${path.relative(repoRoot, WALLET_SERVICE_ENV)} from .env.example`)
}

const ensureWalletServiceEnv = async () => {
  ensureWalletServiceDotenv()
  const env = parseEnvFile(WALLET_SERVICE_ENV)
  const token = env.CANTON_BACKEND_TOKEN
  if (token !== undefined && token !== '' && token !== TOKEN_PLACEHOLDER) {
    log('wallet-service: CANTON_BACKEND_TOKEN already set')
    return
  }
  log('wallet-service: minting CANTON_BACKEND_TOKEN')
  const minted = await captureStep('canton:token', 'npm', ['run', '--silent', 'canton:token'])
  const lines = readFileSync(WALLET_SERVICE_ENV, 'utf8').split(/\r?\n/)
  let replaced = false
  const updated = lines.map((line) => {
    if (line.startsWith('CANTON_BACKEND_TOKEN=')) {
      replaced = true
      return `CANTON_BACKEND_TOKEN=${minted}`
    }
    return line
  })
  if (!replaced) {
    updated.push(`CANTON_BACKEND_TOKEN=${minted}`)
  }
  writeFileSync(WALLET_SERVICE_ENV, updated.join('\n'))
  log('wallet-service: wrote fresh CANTON_BACKEND_TOKEN')
}

const main = async () => {
  log('preflight checks')
  await requireDocker()
  await requireDamlToolchain()
  requireEnvFileWithViteProjectId(WALLET_DOTENV, 'carpincho-wallet')
  requireEnvFileWithViteProjectId(APP_DOTENV, 'counter/frontend')
  await requirePortsFree(DEV_PORTS)
  log('preflight ok')

  await ensureCantonUp()
  await ensureDarBuilt()
  await ensureDarDeployed()
  await ensureWalletServiceEnv()

  log('starting dev servers (wallet-service, wallet, app). Ctrl-C to stop.')
  log(`canton container stays up. Stop it with: npm run canton:down`)
  log(`endpoints: ${WALLET_SERVICE_HEALTH} | ${WALLET_DEV} | ${APP_DEV}`)
  const supervisor = new DevSupervisor()
  supervisor.spawn('wallet-service', 'npm', ['run', 'wallet-service:dev'])
  supervisor.spawn('wallet', 'npm', ['run', 'wallet:dev'])
  supervisor.spawn('app', 'npm', ['run', 'app:dev'])
  await supervisor.waitForExit()
}

main().catch((error) => {
  fail(error.stack ?? error.message ?? String(error))
})
