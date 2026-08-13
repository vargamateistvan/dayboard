# Dayboard

Dayboard is a customizable dashboard built with React, TypeScript, and Vite. It brings together widgets for time, weather, calendar, tasks, notes, media, markets, and focus-friendly productivity.

## Features

- Clock and timezone clock widgets
- Weather widget
- Flights radar widget
- Calendar widget with iCal feed support and event notifications
- Timer panel
- Task widget
- Sticky notes widget
- Spotify, Apple Music, and Apple Podcast widgets
- Stocks and currency widgets
- Quote of the day widget
- Focus mode
- Fullscreen widget view
- Multiple themes
- Customizable widget visibility and layout
- Notification badge for upcoming events
- Buy me a coffee widget

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn or npm

### Install

```bash
yarn install
# or
npm install
```

### Development

```bash
yarn dev
# or
npm run dev
```

The app runs at `http://localhost:5173/dayboard/`.

### HTTPS Development

```bash
yarn dev:https
# or
npm run dev:https
```

### HTTPS Preview

```bash
yarn preview:https
# or
npm run preview:https
```

### Spotify setup

If you want to connect a Spotify account from the Dayboard settings:

1. Create an app in the Spotify Developer Dashboard.
2. Add your app URLs to the Spotify app's redirect URI list.
3. Set `VITE_SPOTIFY_CLIENT_ID` in your local `.env`.
4. Optionally set `VITE_SPOTIFY_REDIRECT_URI` if the redirect should differ from the current page URL.

```bash
VITE_SPOTIFY_CLIENT_ID=your-spotify-client-id
# Optional:
# VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/dayboard/
```

Dayboard uses Spotify Authorization Code with PKCE in the browser, so the Spotify client secret must not be added to frontend environment variables.

If you deploy through GitHub Actions/GitHub Pages, add `VITE_SPOTIFY_CLIENT_ID` as a repository secret too; the build workflow injects it during `yarn build`.

### Build

```bash
yarn build
# or
npm run build
```

### Preview

```bash
yarn preview
# or
npm run preview
```

### Tests

```bash
yarn test
# or
npm test
```

```bash
yarn test:watch
# or
npm run test:watch
```

### Lint

```bash
yarn lint
# or
npm run lint
```

## Dev Proxies

The Vite dev server exposes:

- `/api/calendar` for remote iCal feeds

These proxies make remote requests work reliably during development and preview.

### Flights in production

The Flights widget uses the free public `airplanes.live` API directly from the browser in production. The app requests the nearby-aircraft endpoint under `https://api.airplanes.live/v2/point/...`, which supports browser CORS.

If you need to override that endpoint, set `VITE_FLIGHTS_API_BASE` to another compatible base URL.

## Project Structure

```text
src/
├── components/   React widgets and UI pieces
├── lib/          Shared hooks, utilities, and settings
├── themes/       Global and theme-specific styles
├── test/         Test setup
├── App.tsx       Main dashboard
└── main.tsx      Entry point
```

## Tech Stack

- React 18
- TypeScript
- Vite
- Vitest
- Testing Library
- ical.js
- Lucide React
- Recharts

## License

MIT
