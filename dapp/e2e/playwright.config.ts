import { defineConfig } from '@playwright/test'

// All endpoints and artifact paths are env-driven so the suite can target either
// the in-tree dev stack (default) or a published-package monorepo build later.
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3010'
const DAPP_URL = process.env.DAPP_URL ?? 'http://localhost:3012'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: DAPP_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: {
    timeout: 5_000,
  },
  projects: [
    {
      name: 'integration',
      use: {
        // Each test owns its persistent browser context (extension fixture).
        // The fixture file resolves baseURL / endpoints from env.
      },
      metadata: {
        walletServiceUrl: WALLET_SERVICE_URL,
        dappUrl: DAPP_URL,
      },
    },
  ],
})
