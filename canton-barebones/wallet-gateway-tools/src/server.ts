import 'dotenv/config'

import { createWalletGatewayToolsApp } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const app = createWalletGatewayToolsApp(config)

app.listen(config.port, () => {
  console.log(`wallet-gateway-tools listening on ${config.port} (auth: ${config.canton.auth.mode})`)
})
