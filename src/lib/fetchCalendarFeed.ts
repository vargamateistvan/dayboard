import { normalizeCalendarUrl } from './calendarUrl'

const LOCAL_PROXY_PATH = '/api/calendar'
const PUBLIC_PROXY_URL_BUILDERS = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
]

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function buildLocalProxyUrl(calendarUrl: string): string {
  return `${LOCAL_PROXY_PATH}?url=${encodeURIComponent(calendarUrl)}`
}

export function getCalendarFeedRequestUrls(
  rawCalendarUrl: string,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
): string[] {
  const calendarUrl = normalizeCalendarUrl(rawCalendarUrl)
  if (!calendarUrl) return []

  const requestUrls = isLocalHostname(hostname)
    ? [buildLocalProxyUrl(calendarUrl), calendarUrl]
    : [calendarUrl, ...PUBLIC_PROXY_URL_BUILDERS.map((buildProxyUrl) => buildProxyUrl(calendarUrl))]

  return [...new Set(requestUrls)]
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Could not load calendar.')
}

export async function fetchCalendarFeed(rawCalendarUrl: string): Promise<string> {
  const requestUrls = getCalendarFeedRequestUrls(rawCalendarUrl)
  let lastError: Error | null = null

  for (const requestUrl of requestUrls) {
    try {
      const response = await fetch(requestUrl)
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      return await response.text()
    } catch (error: unknown) {
      lastError = toError(error)
    }
  }

  throw lastError ?? new Error('Could not load calendar.')
}

export async function fetchCalendarFeeds(rawCalendarUrls: string[]): Promise<string[]> {
  const results = await Promise.allSettled(rawCalendarUrls.map((calendarUrl) => fetchCalendarFeed(calendarUrl)))
  const successfulFeeds = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])

  if (successfulFeeds.length > 0) {
    return successfulFeeds
  }

  const failedResults = results.flatMap((result) => result.status === 'rejected' ? [toError(result.reason)] : [])
  throw failedResults[0] ?? new Error('Could not load calendar.')
}
