import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bootstrap-lite.css'
import './index.css'
import App from './App.js'

if (window.location.protocol === 'chrome-extension:') {
  document.documentElement.dataset.runtime = 'extension'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
