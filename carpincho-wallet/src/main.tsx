import '@fontsource-variable/fraunces'
import '@fontsource-variable/manrope'
import '@fontsource-variable/roboto-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App.tsx'
import { ThemeProvider } from '@/theme/ThemeProvider.tsx'

if (window.location.protocol === 'chrome-extension:') {
  document.documentElement.dataset.runtime = 'extension'
}

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
