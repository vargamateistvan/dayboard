# AGENTS.md

Guidance for AI coding agents working in this repository. Read [README.md](README.md) for the user-facing setup.

## Project

Dayboard is a client-only React 18 + TypeScript + Vite dashboard of widgets (clock, weather, calendar, timers, media, markets, flights, …). There is no backend: all state lives in `localStorage`, and it ships as a static site to GitHub Pages under the `/dayboard/` base path. The only server-side code is the Cloudflare Worker in [proxy/](proxy/), which proxies flight data.

## Commands

Use **yarn** (`yarn.lock` is committed; CI runs `corepack enable` + `yarn install`).

| Task | Command |
| --- | --- |
| Dev server | `yarn dev` → http://localhost:5173/dayboard/ |
| Dev over HTTPS | `yarn dev:https` (mkcert) |
| Tests | `yarn test` (Vitest, jsdom) |
| Single test file | `yarn vitest run src/lib/__tests__/storage.test.ts` |
| Lint | `yarn lint` |
| Type-check + build | `yarn build` (`tsc -b && vite build`) |
| Proxy type-check | `cd proxy && yarn type-check` |

Before finishing a change, run `yarn lint`, `yarn test` and `yarn build`. CI ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs exactly these on every push to `main` and deploys only if all pass.

## Layout

```text
src/
├── App.tsx            Dashboard shell; maps widget ids to components
├── main.tsx           Entry; runs initializeTheme / initializeSpotifyAuth before render
├── components/        One widget/component per file + matching *.module.css
│   └── __tests__/     Component tests
├── lib/               Hooks, API clients, settings, storage, pure helpers
│   └── __tests__/     Unit tests
├── themes/            base.css (CSS variable contract) + one file per theme
└── test/setup.ts      jsdom stubs: matchMedia, localStorage, ResizeObserver, PointerEvent
proxy/                 Cloudflare Worker (separate package, own yarn.lock and tsconfig)
docs/prd/              Product requirements
```

## Conventions

### Code style
- TypeScript `strict`, with `noUnusedLocals`/`noUnusedParameters`. Prefix intentionally unused names with `_`.
- Most files in `src/` use single quotes and no semicolons. A few (`main.tsx`, `useWidgetVisibility.ts`, `SettingsDialog.tsx`, `WeatherWidget.tsx`, `TimerPanel.tsx`, …) use double quotes and semicolons. Match the file you are editing. There is no Prettier config.
- Components are function components with `readonly` props interfaces. Styling uses CSS Modules (`Foo.module.css` imported as `styles`).
- Colors, fonts and spacing come from CSS custom properties defined in [src/themes/base.css](src/themes/base.css) (`--color-text`, `--color-accent`, …). Use those variables, not hard-coded colors, so every theme and light/dark mode keeps working.
- Comments explain *why* (browser quirks, upstream API behavior, security reasons), not what. Keep that density.
- Icons come from `lucide-react`.

### Persistence
- Never call `localStorage` directly. Use [src/lib/storage.ts](src/lib/storage.ts) (`readStorage`, `writeStorage`, `readJson`, `writeJson`). Reads never throw, and failed writes fire `STORAGE_ERROR_EVENT` so the UI can warn the user.
- For component state that persists and syncs across tabs, use `useSyncedStorage(key, normalize, fallback)` from [src/lib/useSyncedStorage.ts](src/lib/useSyncedStorage.ts). It writes only when the setter is called, never on mount.
- Storage keys use the `dayboard:` prefix.
- Every value read from storage or an imported preset goes through a `normalize*` function that accepts `unknown` and falls back to a default. Do not trust stored shapes, because older versions and hand-edited presets exist.

### Settings
All user settings live in one `Settings` object in [src/lib/settings.ts](src/lib/settings.ts) and are read with `useSettings()`. To add a setting:
1. Add the field to the `Settings` interface and to `DEFAULT_SETTINGS`.
2. Write a `normalizeX(value: unknown)` function and use it in the normalization path.
3. Include the field where settings are saved, and add a rule to `validateSettings`.
4. Add the control to [src/components/SettingsDialog.tsx](src/components/SettingsDialog.tsx) (local state, reset from `nextSettings`, save).
5. Add tests in `src/lib/__tests__/` (e.g. `settingsValidation.test.ts`).

Follow an existing setting end to end (for example `clockHourFormat`) as a template.

### Widgets
To add a widget:
1. Add its id to `WIDGET_IDS` in [src/lib/useWidgetVisibility.ts](src/lib/useWidgetVisibility.ts). Types keyed by `Widget` (`Record<Widget, …>`) will then fail `tsc` everywhere a default visibility or placement is needed. Fix each one.
2. Add a label in [src/lib/widgetMetadata.ts](src/lib/widgetMetadata.ts).
3. Create `src/components/FooWidget.tsx` + `FooWidget.module.css`. Widgets take an optional `isFullscreen` prop.
4. Register the renderer in the widget map in [src/App.tsx](src/App.tsx).
5. Layout state migrations and repairs are handled in `useWidgetVisibility.ts`. See `layoutRepair.test.ts` before changing grid logic.

### Data fetching and timing
- Widgets that poll an API use `usePolledResource(fetcher, { intervalMs, key })` from [src/lib/usePolledResource.ts](src/lib/usePolledResource.ts). It handles abort, pausing while hidden, and failure backoff. Do not hand-roll `setInterval` + `fetch`.
- Put API clients and parsing in `src/lib/` as plain functions so they can be unit tested without React.
- Anything that shows wall-clock seconds uses `scheduleEverySecond` ([src/lib/scheduleEverySecond.ts](src/lib/scheduleEverySecond.ts)), not `setInterval(…, 1000)`.

### Security
- User-supplied URLs that reach `href` or iframe `src` must pass `isSafeHttpUrl` / `safeHttpUrlOr` from [src/lib/urlSafety.ts](src/lib/urlSafety.ts).
- OAuth (Google, Spotify) is PKCE in the browser. Only client IDs go in `VITE_*` env vars. Never add client secrets or other secrets to frontend code or env.
- The dev calendar proxy in [vite.config.ts](vite.config.ts) deliberately serves upstream content as `text/plain` with a sandbox CSP. Keep it that way.
- `.env` is gitignored. Document new variables in [.env.example](.env.example).

## Testing

- Vitest with `globals: true` and Testing Library (`@testing-library/react`, `user-event`, `jest-dom`).
- `localStorage` is a stub cleared after every test. Seed it in the test itself.
- Mock `fetch` and use fake timers for polling and clock code. Existing tests in `src/lib/__tests__/` show the patterns (`usePolledResource.test.ts`, `useTimerAccuracy.test.ts`, `flightsBackoff.test.ts`).
- Bug fixes come with a regression test. Name files after the unit (`Foo.test.tsx`) or the behavior under test (`FooBehavior.test.tsx`, `fooReliability.test.ts`).

## Commits and releases

- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, with optional scope such as `feat(proxy):`). [.github/workflows/versioning.yml](.github/workflows/versioning.yml) derives the semver bump and release notes from commit subjects: `feat` → minor, `!` or `BREAKING CHANGE:` → major, anything else → patch.
- Every push to `main` deploys to GitHub Pages and tags a release. Changes under `proxy/` also deploy the Worker.
- Do not commit `dist/`, `.env`, or `tsconfig.tsbuildinfo` changes unless that is intended.

## Proxy (Cloudflare Worker)

[proxy/](proxy/) is its own package: run `yarn install` inside it, and type-check with `yarn type-check`. It only forwards `/v2/point/{lat}/{lon}/{radiusNm}` flight queries, adds CORS headers, and uses the Cache API (no KV). The Vite dev server has an equivalent `/api/flights` middleware. If you change the request shape in one, update the other. See [proxy/README.md](proxy/README.md).
