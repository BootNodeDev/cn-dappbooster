// Entrypoint: load config, wire the context, refresh the projection, arm the
// scheduler, and start listening.
import { loadConfig } from './config.ts'
import { createApp } from './http.ts'
import { buildContext } from './wiring.ts'

const main = async (): Promise<void> => {
  const config = loadConfig()
  const ctx = buildContext(config)
  await ctx.projection.refresh()
  ctx.scheduler.start()
  createApp(ctx).listen(config.port, () => {
    console.log(
      `dark-pool-service listening on :${config.port} (${config.mock ? 'mock' : config.auth.source} ledger)`,
    )
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
