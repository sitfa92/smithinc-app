import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Inject ManyChat website chat widget when a Page ID is configured.
// Set VITE_MANYCHAT_PAGE_ID in your .env / Vercel environment variables.
// If the variable is absent the widget is simply not loaded.
;(function injectManyChatWidget() {
  const pageId = (import.meta.env.VITE_MANYCHAT_PAGE_ID || '').trim()
  if (!pageId) return

  const script = document.createElement('script')
  script.src = '//widget.manychat.com/' + encodeURIComponent(pageId) + '.js'
  script.async = true
  script.defer = true
  script.onerror = () => {};
  document.head.appendChild(script)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
