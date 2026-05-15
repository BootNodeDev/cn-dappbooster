import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension'

  return {
    base: isExtension ? './' : '/',
    plugins: [react()],
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist'
    },
    server: {
      host: 'localhost',
      port: 3011,
      strictPort: true
    }
  }
})
