import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/ErrorBoundary";
import { initializeTheme } from "./initializeTheme";
import { initializeSpotifyAuth } from "./initializeSpotifyAuth";
import { migrateWorldClockCities } from "./lib/worldClockStorage";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/orbitron/400.css";
import "@fontsource/doto/400.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/bitcount-single/400.css";

// Initialize theme from localStorage before rendering
initializeTheme();
// Before the app renders and re-saves settings, which drops the old city fields.
migrateWorldClockCities();

async function bootstrap() {
  await initializeSpotifyAuth();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void bootstrap();
