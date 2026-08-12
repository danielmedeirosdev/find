import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PUBLIC_SITE_ORIGIN } from './lib/site'

if (window.location.hostname.endsWith('.vercel.app')) {
  const { pathname, search, hash } = window.location
  window.location.replace(`${PUBLIC_SITE_ORIGIN}${pathname}${search}${hash}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
