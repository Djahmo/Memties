import { StrictMode } from 'react'
import './i18n'
import './i18n/validation'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import 'virtual:uno.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
