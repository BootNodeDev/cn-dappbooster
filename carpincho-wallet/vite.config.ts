import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension'

  return {
    base: isExtension ? './' : '/',
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      rollupOptions: isExtension
        ? {
            input: {
              app: resolve(__dirname, 'index.html'),
              contentScript: resolve(__dirname, 'src/extension/contentScript.ts'),
              background: resolve(__dirname, 'src/extension/background.ts'),
            },
            output: {
              entryFileNames: (chunk) =>
                chunk.name === 'contentScript' || chunk.name === 'background'
                  ? '[name].js'
                  : 'assets/[name]-[hash].js',
            },
          }
        : undefined,
    },
    server: {
      host: 'localhost',
      port: 3011,
      strictPort: true,
    },
  }
})
