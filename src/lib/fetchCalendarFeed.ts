import { normalizeCalendarUrl } from './calendarUrl'
import type { CalendarFeed } from './settings'
import {
  fetchGoogleCalendarEvents,
  getStoredGoogleAuth,
  getValidGoogleAuth,
  parseGoogleCalendarFeedUrl,
} from './googleAuth'

const LOCAL_PROXY_PATH = '/api/calendar'
const GOOGLE_CALENDAR_HOST = 'calendar.google.com'
const JINA_MIRROR_PREFIX = 'https://r.jina.ai/http://'
const MISSING_CALENDAR_LINK_ERROR = 'Calendar link is missing. Add one in settings.'

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function buildLocalProxyUrl(calendarUrl: string): string {
  return `${LOCAL_PROXY_PATH}?url=${encodeURIComponent(calendarUrl)}`
}

function buildJinaMirrorUrl(calendarUrl: string): string {
  return `${JINA_MIRROR_PREFIX}${calendarUrl.replace(/^https?:\/\//, '')}`
}

function shouldPreferMirror(calendarUrl: string): boolean {
  try {
    return new URL(calendarUrl).hostname === GOOGLE_CALENDAR_HOST
  } catch {
    return false
  }
}

export function getCalendarFeedRequestUrls(
  rawCalendarUrl: string,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
): string[] {
  const calendarUrl = normalizeCalendarUrl(rawCalendarUrl)
  if (!calendarUrl) return []

  const mirrorUrl = buildJinaMirrorUrl(calendarUrl)
  const requestUrls = isLocalHostname(hostname)
    ? [buildLocalProxyUrl(calendarUrl), calendarUrl]
    : shouldPreferMirror(calendarUrl)
      ? [mirrorUrl, calendarUrl]
      : [calendarUrl, mirrorUrl]

  return [...new Set(requestUrls)]
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Could not load calendar.')
}

function normalizeCalendarFeedText(text: string): string {
  const beginIndex = text.indexOf('BEGIN:VCALENDAR')
  if (beginIndex === -1) {
    return text
  }

  const endMarker = 'END:VCALENDAR'
  const endIndex = text.lastIndexOf(endMarker)
  if (endIndex === -1 || endIndex < beginIndex) {
    return text.slice(beginIndex).trim()
  }

  return text.slice(beginIndex, endIndex + endMarker.length).trim()
}

export async function fetchCalendarFeed(rawCalendarUrl: string): Promise<string> {
  // Google Calendar API feeds use a special scheme
  const googleCalendarId = parseGoogleCalendarFeedUrl(rawCalendarUrl)
  if (googleCalendarId !== null) {
    const auth = getStoredGoogleAuth()
    if (!auth) {
      throw new Error('Google Calendar is not connected. Please sign in to Google in settings.')
    }
    const validAuth = await getValidGoogleAuth(auth)
    return fetchGoogleCalendarEvents(googleCalendarId, validAuth)
  }

  const requestUrls = getCalendarFeedRequestUrls(rawCalendarUrl)
  if (requestUrls.length === 0) {
    throw new Error(MISSING_CALENDAR_LINK_ERROR)
  }

  let lastError: Error | null = null

  for (const requestUrl of requestUrls) {
    try {
      const response = await fetch(requestUrl)
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        continue
      }

      const text = normalizeCalendarFeedText(await response.text())
      if (!text.includes('BEGIN:VCALENDAR')) {
        lastError = new Error('Unexpected calendar response.')
        continue
      }

      return text
    } catch (error: unknown) {
      lastError = toError(error)
    }
  }

  throw lastError ?? new Error('Could not load calendar.')
}

export interface FetchedCalendarFeed {
  feed: CalendarFeed
  text: string
}

export async function fetchCalendarFeeds(rawCalendarFeeds: CalendarFeed[]): Promise<FetchedCalendarFeed[]> {
  const results = await Promise.allSettled(
    rawCalendarFeeds.map((feed) => fetchCalendarFeed(feed.url)),
  )
  const successfulFeeds = results.flatMap((result, index) => result.status === 'fulfilled'
    ? [{ feed: rawCalendarFeeds[index], text: result.value }]
    : [])

  if (successfulFeeds.length > 0) {
    return successfulFeeds
  }

  const failedResults = results.flatMap((result) => result.status === 'rejected' ? [toError(result.reason)] : [])
  const missingLinkError = failedResults.find((error) => error.message === MISSING_CALENDAR_LINK_ERROR)
  if (missingLinkError) {
    throw missingLinkError
  }

  throw failedResults[0] ?? new Error('Could not load calendar.')
}
