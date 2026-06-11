import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3012,
    strictPort: true,
  },
  // happy-dom gives the wallet stack (canton-connect-kit → dapp-sdk → lit) the
  // DOM globals it touches at import time, so store/component tests can load it.
  test: {
    environment: 'happy-dom',
  },
})
