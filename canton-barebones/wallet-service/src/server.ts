import 'dotenv/config'

import { createWalletServiceApp } from './app.ts'
import { loadConfig } from './config.ts'
import { isMockEnabled } from './mock.ts'

const config = loadConfig()
const mockEnabled = isMockEnabled()
const app = createWalletServiceApp(config)

app.listen(config.port, () => {
  const suffix = mockEnabled ? ' (MOCK MODE — no Canton calls)' : ''
  console.log(
    `wallet-service listening on ${config.port}${suffix} (token: ${config.canton.tokenSource})`,
  )
})
