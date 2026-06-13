import 'dotenv/config'

import { createWalletServiceApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDarUploadApi, createMockDarUploadApi } from './dars.ts'
import { createMockPartyApi, createMockRpc, createMockState, isMockEnabled } from './mock.ts'
import { createPartyApi } from './party.ts'
import { createRpc } from './rpc.ts'

const config = loadConfig()
const mockEnabled = isMockEnabled()
const mockState = mockEnabled ? createMockState() : undefined
const rpc = mockState !== undefined ? createMockRpc(config, mockState) : createRpc(config)
const adminParty =
  mockState !== undefined
    ? createMockPartyApi(config, mockState)
    : createPartyApi(config, { getSdk: () => rpc.getSdk() })
const darApi = mockState !== undefined ? createMockDarUploadApi() : createDarUploadApi(config)
const app = createWalletServiceApp({
  config,
  mockEnabled,
  rpc,
  adminParty,
  darApi,
})

app.listen(config.port, () => {
  const suffix = mockEnabled ? ' (MOCK MODE — no Canton calls)' : ''
  console.log(
    `wallet-service listening on ${config.port}${suffix} (auth: ${config.canton.tokenSource})`,
  )
})
