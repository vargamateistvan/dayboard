export interface GoogleAuthSession {
  accessToken: string
  expiresAt: number
}

export interface GoogleCalendarListEntry {
  id: string
  summary: string
  backgroundColor: string
  primary?: boolean
  accessRole: string
}

// GIS token client type (subset of the google.accounts.oauth2 API)
interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
          }): GisTokenClient
        }
      }
    }
  }
}

const GOOGLE_AUTH_STORAGE_KEY = 'dayboard_google_auth'
const EXPIRY_BUFFER_MS = 60_000
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

function getGoogleClientId(): string {
  const configured = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim()
  }
  return ''
}

function readStoredAuth(): GoogleAuthSession | null {
  const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<GoogleAuthSession>
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null
    }
    // Discard expired tokens immediately
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY)
      return null
    }
    return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function persistAuth(auth: GoogleAuthSession) {
  localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(auth))
}

export function getStoredGoogleAuth(): GoogleAuthSession | null {
  return readStoredAuth()
}

export function clearStoredGoogleAuth() {
  localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY)
}

function waitForGis(): Promise<typeof window.google> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google)
      return
    }
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        resolve(window.google)
      }
    }, 100)
    // Give up after 10 seconds
    setTimeout(() => {
      clearInterval(interval)
      resolve(undefined)
    }, 10_000)
  })
}

export function startGoogleLogin(): Promise<GoogleAuthSession> {
  const clientId = getGoogleClientId()
  if (!clientId) {
    return Promise.reject(new Error('Google Client ID is not configured. Set VITE_GOOGLE_CLIENT_ID in your .env file.'))
  }

  return waitForGis().then((google) => {
    if (!google) {
      throw new Error('Google Identity Services failed to load. Check your internet connection.')
    }

    return new Promise<GoogleAuthSession>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(`Google login failed: ${response.error ?? 'no access token'}`))
            return
          }
          const auth: GoogleAuthSession = {
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
          }
          persistAuth(auth)
          resolve(auth)
        },
      })
      tokenClient.requestAccessToken({ prompt: 'consent' })
    })
  })
}

export async function getValidGoogleAuth(auth: GoogleAuthSession): Promise<GoogleAuthSession> {
  if (Date.now() + EXPIRY_BUFFER_MS < auth.expiresAt) {
    return auth
  }
  // Token expired — need to re-authenticate silently (no prompt)
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('Google Client ID is not configured.')

  const google = await waitForGis()
  if (!google) throw new Error('Google Identity Services failed to load.')

  return new Promise<GoogleAuthSession>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          clearStoredGoogleAuth()
          reject(new Error('Google session expired. Please sign in again.'))
          return
        }
        const refreshed: GoogleAuthSession = {
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        }
        persistAuth(refreshed)
        resolve(refreshed)
      },
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export async function fetchGoogleCalendarList(auth: GoogleAuthSession): Promise<GoogleCalendarListEntry[]> {
  const validAuth = await getValidGoogleAuth(auth)

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    { headers: { Authorization: `Bearer ${validAuth.accessToken}` } },
  )

  if (!response.ok) {
    throw new Error('Failed to fetch Google Calendar list.')
  }

  const data = await response.json() as {
    items?: Array<{
      id: string
      summary?: string
      backgroundColor?: string
      primary?: boolean
      accessRole?: string
    }>
  }

  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    backgroundColor: item.backgroundColor ?? '#4f46e5',
    primary: item.primary,
    accessRole: item.accessRole ?? 'reader',
  }))
}

/** Sentinel URL scheme used to identify Google Calendar API feeds. */
export const GOOGLE_CALENDAR_API_SCHEME = 'googlecalendar://'

export function buildGoogleCalendarFeedUrl(calendarId: string): string {
  return `${GOOGLE_CALENDAR_API_SCHEME}${encodeURIComponent(calendarId)}`
}

export function parseGoogleCalendarFeedUrl(url: string): string | null {
  if (!url.startsWith(GOOGLE_CALENDAR_API_SCHEME)) return null
  return decodeURIComponent(url.slice(GOOGLE_CALENDAR_API_SCHEME.length))
}

function googleEventToIcalLine(value: string): string {
  const chunks: string[] = []
  while (value.length > 75) {
    chunks.push(value.slice(0, 75))
    value = ' ' + value.slice(75)
  }
  chunks.push(value)
  return chunks.join('\r\n')
}

function escapeIcalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcalDate(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

interface GoogleEvent {
  id?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  organizer?: { displayName?: string; email?: string }
  attendees?: Array<{ displayName?: string; email?: string; responseStatus?: string }>
  status?: string
}

function googleEventsToIcal(calendarId: string, events: GoogleEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Dayboard//Google Calendar ${calendarId}//EN`,
  ]

  for (const event of events) {
    if (event.status === 'cancelled') continue

    const allDay = !event.start?.dateTime
    const startRaw = event.start?.dateTime ?? event.start?.date
    const endRaw = event.end?.dateTime ?? event.end?.date
    if (!startRaw || !endRaw) continue

    const startDate = new Date(startRaw)
    const endDate = new Date(endRaw)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id ?? Math.random().toString(36)}@google`)
    lines.push(googleEventToIcalLine(
      allDay ? `DTSTART;VALUE=DATE:${formatIcalDate(startDate, true)}` : `DTSTART:${formatIcalDate(startDate, false)}`,
    ))
    lines.push(googleEventToIcalLine(
      allDay ? `DTEND;VALUE=DATE:${formatIcalDate(endDate, true)}` : `DTEND:${formatIcalDate(endDate, false)}`,
    ))
    if (event.summary) lines.push(googleEventToIcalLine(`SUMMARY:${escapeIcalText(event.summary)}`))
    if (event.description) lines.push(googleEventToIcalLine(`DESCRIPTION:${escapeIcalText(event.description)}`))
    if (event.location) lines.push(googleEventToIcalLine(`LOCATION:${escapeIcalText(event.location)}`))
    if (event.htmlLink) lines.push(googleEventToIcalLine(`URL:${event.htmlLink}`))
    if (event.organizer) {
      const cn = event.organizer.displayName ?? event.organizer.email ?? ''
      lines.push(googleEventToIcalLine(`ORGANIZER;CN=${escapeIcalText(cn)}:mailto:${event.organizer.email ?? ''}`))
    }
    for (const attendee of event.attendees ?? []) {
      const cn = attendee.displayName ?? attendee.email ?? ''
      const partstat = attendee.responseStatus === 'accepted' ? 'ACCEPTED'
        : attendee.responseStatus === 'declined' ? 'DECLINED' : 'NEEDS-ACTION'
      lines.push(googleEventToIcalLine(`ATTENDEE;CN=${escapeIcalText(cn)};PARTSTAT=${partstat}:mailto:${attendee.email ?? ''}`))
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export async function fetchGoogleCalendarEvents(
  calendarId: string,
  auth: GoogleAuthSession,
): Promise<string> {
  const validAuth = await getValidGoogleAuth(auth)

  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 12, 1).toISOString()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${validAuth.accessToken}` } },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch events for calendar "${calendarId}".`)
  }

  const data = await response.json() as { items?: GoogleEvent[] }
  return googleEventsToIcal(calendarId, data.items ?? [])
}

/** No-op: GIS handles the callback flow differently — kept for App.tsx compatibility. */
export async function completeGoogleLoginFromUrl(): Promise<null> {
  return null
}

