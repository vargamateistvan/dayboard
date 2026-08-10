import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const CALENDAR_PROXY_PATH = '/api/calendar'
const FLIGHTS_PROXY_PATH = '/api/flights'

async function handleCalendarProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const targetUrl = requestUrl.searchParams.get('url')

  if (!targetUrl) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Missing calendar url.')
    return
  }

  let remoteUrl: URL
  try {
    remoteUrl = new URL(targetUrl)
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Invalid calendar url.')
    return
  }

  if (remoteUrl.protocol !== 'http:' && remoteUrl.protocol !== 'https:') {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Unsupported calendar url protocol.')
    return
  }

  try {
    const response = await fetch(remoteUrl)
    res.statusCode = response.status

    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    const cacheControl = response.headers.get('cache-control')
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl)
    }

    res.end(await response.text())
  } catch (error: unknown) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(error instanceof Error ? error.message : 'Calendar proxy request failed.')
  }
}

function parseFlightQueryCoordinate(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function handleFlightsProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost')
  const lamin = parseFlightQueryCoordinate(requestUrl.searchParams.get('lamin'), Number.NaN)
  const lomin = parseFlightQueryCoordinate(requestUrl.searchParams.get('lomin'), Number.NaN)
  const lamax = parseFlightQueryCoordinate(requestUrl.searchParams.get('lamax'), Number.NaN)
  const lomax = parseFlightQueryCoordinate(requestUrl.searchParams.get('lomax'), Number.NaN)

  const hasInvalidBounds =
    !Number.isFinite(lamin) ||
    !Number.isFinite(lomin) ||
    !Number.isFinite(lamax) ||
    !Number.isFinite(lomax) ||
    lamin < -90 ||
    lamax > 90 ||
    lomin < -180 ||
    lomax > 180 ||
    lamin >= lamax ||
    lomin >= lomax

  if (hasInvalidBounds) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Invalid flight bounds.')
    return
  }

  const remoteUrl = new URL('https://opensky-network.org/api/states/all')
  remoteUrl.searchParams.set('lamin', lamin.toFixed(4))
  remoteUrl.searchParams.set('lomin', lomin.toFixed(4))
  remoteUrl.searchParams.set('lamax', lamax.toFixed(4))
  remoteUrl.searchParams.set('lomax', lomax.toFixed(4))

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        Accept: 'application/json',
      },
    })

    res.statusCode = response.status

    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    res.setHeader('Cache-Control', 'no-store')
    res.end(await response.text())
  } catch (error: unknown) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(error instanceof Error ? error.message : 'Flight proxy request failed.')
  }
}

function dayboardProxyPlugin() {
  return {
    name: 'dayboard-proxy',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use(CALENDAR_PROXY_PATH, (req, res) => {
        void handleCalendarProxy(req, res)
      })
      server.middlewares.use(FLIGHTS_PROXY_PATH, (req, res) => {
        void handleFlightsProxy(req, res)
      })
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use(CALENDAR_PROXY_PATH, (req, res) => {
        void handleCalendarProxy(req, res)
      })
      server.middlewares.use(FLIGHTS_PROXY_PATH, (req, res) => {
        void handleFlightsProxy(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), dayboardProxyPlugin()],
  base: '/dayboard/',
  server: {
    https: process.env.DAYBOARD_HTTPS === 'true',
  },
  preview: {
    https: process.env.DAYBOARD_HTTPS === 'true',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
