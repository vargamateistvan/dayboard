const GOOGLE_CALENDAR_HOST = 'calendar.google.com'
const OUTLOOK_CALENDAR_HOSTS = new Set([
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'outlook.office365.us',
])

function decodeGoogleCalendarId(value: string): string | null {
  const decodedValue = decodeURIComponent(value.trim())
  if (!decodedValue) return null
  if (decodedValue.includes('@')) return decodedValue

  const normalizedBase64 = decodedValue.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalizedBase64.length % 4
  const paddedBase64 = padding === 0
    ? normalizedBase64
    : `${normalizedBase64}${'='.repeat(4 - padding)}`

  try {
    const decodedCalendarId = atob(paddedBase64)
    return decodedCalendarId.includes('@') ? decodedCalendarId : null
  } catch {
    return null
  }
}

function buildGoogleCalendarIcsUrl(calendarId: string): string {
  return `https://${GOOGLE_CALENDAR_HOST}/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`
}

export function normalizeCalendarUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) return ''

  let url: URL
  try {
    url = new URL(trimmedUrl.replace(/^webcal:/i, 'https:'))
  } catch {
    return trimmedUrl
  }

  if (url.hostname === GOOGLE_CALENDAR_HOST) {
    const calendarId = decodeGoogleCalendarId(url.searchParams.get('cid') ?? url.searchParams.get('src') ?? '')
    if (!calendarId) return url.toString()

    return buildGoogleCalendarIcsUrl(calendarId)
  }

  if (OUTLOOK_CALENDAR_HOSTS.has(url.hostname) && url.pathname.endsWith('/calendar.html')) {
    url.pathname = `${url.pathname.slice(0, -'.html'.length)}.ics`
  }

  return url.toString()
}
