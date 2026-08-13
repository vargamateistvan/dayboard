import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const CALENDAR_PROXY_PATH = '/api/calendar'

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

function dayboardProxyPlugin() {
  return {
    name: 'dayboard-proxy',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use(CALENDAR_PROXY_PATH, (req, res) => {
        void handleCalendarProxy(req, res)
      })
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use(CALENDAR_PROXY_PATH, (req, res) => {
        void handleCalendarProxy(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), basicSsl(), dayboardProxyPlugin()],
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
