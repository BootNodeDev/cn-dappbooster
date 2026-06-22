import 'dotenv/config'

import { createWalletGatewayDevkitApp } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const app = createWalletGatewayDevkitApp(config)

app.listen(config.port, () => {
  console.log(
    `wallet-gateway-devkit listening on ${config.port} (auth: ${config.canton.auth.mode})`,
  )
})
