import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './components/ErrorBoundary'
import { initializeTheme } from './initializeTheme'
import { initializeSpotifyAuth } from './initializeSpotifyAuth'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/orbitron/400.css'
import '@fontsource/doto/400.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/bitcount-single/400.css'

// Spotify only accepts loopback-IP redirect URIs in development, and the OAuth
// state is kept in per-origin storage, so the dev app must run on 127.0.0.1.
const shouldMoveToLoopbackIp = import.meta.env.DEV && window.location.hostname === 'localhost'
if (shouldMoveToLoopbackIp) {
  const url = new URL(window.location.href)
  url.hostname = '127.0.0.1'
  window.location.replace(url.toString())
}

// Initialize theme from localStorage before rendering
initializeTheme()

async function bootstrap() {
  await initializeSpotifyAuth()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}

if (!shouldMoveToLoopbackIp) {
  void bootstrap()
}
