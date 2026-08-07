# Dayboard — Day-Start Productivity Dashboard

## Problem Statement

Knowledge workers start their day scattered: weather is in one tab, calendar in another, timers are ad-hoc browser extensions, and there is no single place to ground a focused work session. Switching between tools breaks flow and delays actually starting work.

## Solution

A single-page web application — **Dayboard** — that surfaces everything needed at the start of the workday in one focused view: current weather, upcoming calendar events, a live clock, and configurable timers (stopwatch, countdown, Pomodoro). A settings dialog lets users connect their own calendar and tune the look of the app.

---

## User Stories

1. As a user, I want to see the current time prominently, so that I always know what time it is without switching windows.
2. As a user, I want to see today's weather (temperature, conditions, location), so that I can plan my day accordingly.
3. As a user, I want to see my calendar events for today, so that I know what meetings or deadlines are coming up.
4. As a user, I want to start a stopwatch, so that I can measure how long I spend on an activity.
5. As a user, I want to start a countdown timer, so that I can time-box tasks.
6. As a user, I want to start a Pomodoro session (configurable work / break intervals), so that I can work in focused blocks.
7. As a user, I want to switch between light mode, dark mode, and system-default, so that the app respects my environment.
8. As a user, I want to choose a visual theme (default, retro, futuristic, and at least one more), so that the app reflects my personal taste.
9. As a user, I want to provide a calendar CSV/ICS URL in settings, so that my events are pulled from my own calendar.
10. As a user, I want my settings (theme, mode, calendar URL, Pomodoro intervals) to persist across page reloads, so that I don't have to reconfigure every time. *(inferred)*
11. As a user, I want to open a settings dialog from the main page, so that I can change preferences without leaving my dashboard.

---

## Implementation Decisions

### Tech Stack
- **React 18 + TypeScript** — component-driven UI with full type safety.
- **Yarn** — package manager.
- **Vite** — development server and build tool (fast HMR, zero config).
- **CSS custom properties / CSS Modules** — theming via CSS variable swaps per theme class on `<body>`.

### Modules

#### 1. `WeatherWidget`
Fetches current weather for the user's location.
- Uses the browser Geolocation API to get coordinates.
- Calls a free, no-auth weather API (Open-Meteo) so no API key is required by default.
- Displays: temperature, weather condition icon/label, location name.
- Refreshes once per hour (or on manual refresh).

#### 2. `CalendarWidget`
Displays today's events from a user-supplied calendar feed.
- Accepts an ICS/CSV URL stored in settings.
- Fetches and parses the feed client-side (via a CORS proxy or direct if CORS allows).
- Shows events sorted by start time; highlights the next upcoming event.
- Gracefully handles missing or invalid URLs (empty state message).

#### 3. `ClockWidget`
Displays the current time and date.
- Updates every second using `setInterval`.
- Respects locale formatting.

#### 4. `TimerPanel`
Contains three timer modes, switchable via tabs:
- **Stopwatch** — start / pause / reset; displays elapsed time to tenths of a second.
- **Countdown** — user sets duration; counts down; plays a sound/notification on completion.
- **Pomodoro** — configurable work interval (default 25 min) and break interval (default 5 min); cycles automatically; tracks session count.

Each mode is its own sub-component; shared timer logic (tick, pause, reset) is extracted into a `useTimer` custom hook.

#### 5. `SettingsDialog`
A modal dialog (triggered by a settings icon in the header).
- **Calendar URL** — text input for ICS/CSV feed URL with a "Test" button.
- **Appearance** — light / dark / system toggle (three-way).
- **Theme picker** — visual swatches for: `default`, `retro`, `futuristic`, `nature`, `ocean`, `sunset`.
- **Pomodoro intervals** — numeric inputs for work and break durations.
- All values read/written via the `useSettings` hook.

#### 6. `useSettings` (custom hook + context)
Single source of truth for all user preferences.
- Persists to `localStorage`.
- Exposes typed read/write API consumed by all widgets and the settings dialog.
- Handles system color-scheme detection via `prefers-color-scheme` media query.

#### 7. Theme System
- Six themes: `default` (clean modern), `retro` (CRT / terminal aesthetic), `futuristic` (neon / glassmorphism), `nature` (earthy / organic), `ocean` (cool marine), `sunset` (warm dusk).
- Each theme is a CSS file that sets a fixed set of CSS custom properties (`--color-bg`, `--color-surface`, `--color-accent`, `--font-family`, etc.).
- Applied by toggling a `data-theme` attribute on `<html>`.
- Light/dark variants within each theme via `data-color-scheme`.

### Layout
- Single-page layout with a responsive grid.
- Header: app name / logo + settings icon button.
- Main grid (desktop: 2-col; mobile: 1-col):
  - Left column: Clock → Weather → Calendar
  - Right column: Timer Panel
- Settings opens as a centered modal overlay with a backdrop.

### Calendar Feed Parsing
- ICS format is preferred; a minimal ICS parser (ical.js or custom) extracts `VEVENT` entries for today.
- CSV format: expected columns `title, start, end` (ISO dates); parsed with a simple split.
- Decision: use `ical.js` (MIT licensed) for ICS parsing; CSV falls back to a custom 10-line parser.

---

## Testing Decisions

- **What makes a good test:** test observable behavior and output, not internal implementation details. Tests should not break when internal code is refactored if the external contract remains the same.
- **Modules to test:**
  - `useTimer` hook — tick progression, pause/resume, reset, completion callback firing.
  - `useSettings` hook — default values, persistence round-trip through localStorage, system theme detection.
  - Calendar feed parser utility — valid ICS, valid CSV, malformed input, empty input, multi-day events (today-only filter).
  - `WeatherWidget` — renders loading state, renders data, renders error state (mock fetch).
  - `CalendarWidget` — renders events, empty state, error state.
- **Framework:** Vitest + React Testing Library (standard for Vite + React projects).
- **Prior art:** no existing tests in repo (greenfield); follow React Testing Library conventions (`userEvent`, `screen` queries).

---

## Out of Scope

- User accounts / cloud sync — settings stay local (localStorage only).
- Push notifications or background service workers.
- Editing calendar events from within the app.
- Multiple calendar feeds (only one URL at a time).
- Native desktop/mobile apps (web only).
- Internationalization / multi-language support.
- Backend server — the app is a fully static client-side SPA.

---

## Further Notes

- Open-Meteo ([https://open-meteo.com](https://open-meteo.com)) is free, no API key, and returns JSON — ideal for avoiding key management in a personal-use app.
- CORS for calendar feeds may require the user to use a public proxy (e.g. `allorigins.win`) or a calendar service that serves CORS headers. The settings dialog should surface a helper note about this.
- The retro theme should feel like an 80s terminal (monospace font, green-on-black or amber-on-black palette). The futuristic theme should lean into glassmorphism and neon accent colors.

---

## Sources

- **User prompt:** _"plan an application where i can start my day and i can improve my work… today weather, my calendar events, the clock, timer stopwatch pomodoro… 1 main page and a settings dialog… calendar csv link… light/dark mode with system default… retro design futuristic themes… react, typescript, yarn"_ (verbatim request in this conversation).
- **Repository consulted:** `vargamateistvan/dayboard` — currently empty (only `.git`); no existing code to constrain decisions.
