// Black-box Playwright fixtures for the cn-dappbooster integration stack.
//
// CONSUMPTION CONTRACT — read before editing:
// This package treats the other four parts of the system as published artifacts.
// It does NOT import from their source. The only ways it consumes them:
//   * HTTP: wallet-gateway-devkit (`WALLET_GATEWAY_DEVKIT_URL`), dApp (`DAPP_URL`).
//   * Filesystem: Carpincho's built extension bundle at `EXTENSION_PATH`.
//
// All of these are env-overridable so a future monorepo migration can point the
// suite at NPM-installed `node_modules/@canton-dappbooster/*` paths without touching
// this file.

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

export const WALLET_GATEWAY_DEVKIT_URL =
  process.env.WALLET_GATEWAY_DEVKIT_URL ?? 'http://localhost:3011'
export const DAPP_URL = process.env.DAPP_URL ?? 'http://localhost:3012'

// Default: the in-tree dev extension. Override via EXTENSION_PATH for published builds.
const DEFAULT_EXTENSION_PATH = path.resolve(moduleDir, '../../../carpincho-wallet/dist-extension')
export const EXTENSION_PATH = process.env.EXTENSION_PATH ?? DEFAULT_EXTENSION_PATH

type StackFixtures = {
  context: BrowserContext
  extensionId: string
}

export const test = base.extend<StackFixtures>({
  context: async ({}, use) => {
    const exists = await fs
      .stat(EXTENSION_PATH)
      .then(() => true)
      .catch(() => false)
    if (!exists) {
      throw new Error(
        `Carpincho extension build not found at ${EXTENSION_PATH}.\n` +
          'Run `npm --prefix carpincho-wallet run build:extension` first, ' +
          'or set EXTENSION_PATH to point at a published artifact.',
      )
    }
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cn-dappbooster-e2e-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    })
    await use(context)
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  },
  extensionId: async ({ context }, use) => {
    let serviceWorker: Worker | undefined = context.serviceWorkers()[0]
    if (serviceWorker === undefined) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }
    const id = serviceWorker.url().split('/')[2]
    await use(id)
  },
})

export { expect } from '@playwright/test'
