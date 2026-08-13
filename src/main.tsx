import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeTheme } from './initializeTheme'
import { initializeSpotifyAuth } from './initializeSpotifyAuth'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/orbitron/400.css'
import '@fontsource/doto/400.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/bitcount-single/400.css'

// Initialize theme from localStorage before rendering
initializeTheme()

async function bootstrap() {
  await initializeSpotifyAuth()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
