export interface CalendarEvent {
  title: string
  start: Date
  end: Date
  allDay: boolean
}

function todayRange(): { startOfDay: Date; endOfDay: Date } {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startOfDay, endOfDay }
}

function isToday(start: Date, end: Date): boolean {
  const { startOfDay, endOfDay } = todayRange()
  return start <= endOfDay && end >= startOfDay
}

// Parse ICS datetime string like 20240807T143000Z or 20240807
function parseIcsDate(raw: string): Date {
  const clean = raw.replace(/^TZID=[^:]+:/, '').trim()
  if (clean.includes('T')) {
    // datetime
    const [datePart, timePart] = clean.split('T')
    const isUtc = timePart.endsWith('Z')
    const tp = timePart.replace('Z', '')
    const year = parseInt(datePart.slice(0, 4))
    const month = parseInt(datePart.slice(4, 6)) - 1
    const day = parseInt(datePart.slice(6, 8))
    const hour = parseInt(tp.slice(0, 2))
    const min = parseInt(tp.slice(2, 4))
    const sec = parseInt(tp.slice(4, 6) || '0')
    return isUtc
      ? new Date(Date.UTC(year, month, day, hour, min, sec))
      : new Date(year, month, day, hour, min, sec)
  } else {
    // date-only (all-day)
    const year = parseInt(clean.slice(0, 4))
    const month = parseInt(clean.slice(4, 6)) - 1
    const day = parseInt(clean.slice(6, 8))
    return new Date(year, month, day)
  }
}

export function parseIcs(text: string): CalendarEvent[] {
  if (!text || !text.includes('BEGIN:VEVENT')) return []

  const events: CalendarEvent[] = []
  // Unfold lines (RFC 5545 line folding: CRLF + space/tab = continuation)
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  let inEvent = false
  let title = ''
  let startRaw = ''
  let endRaw = ''
  let allDay = false

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      title = ''
      startRaw = ''
      endRaw = ''
      allDay = false
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (startRaw) {
        try {
          const start = parseIcsDate(startRaw)
          const end = endRaw ? parseIcsDate(endRaw) : new Date(start.getTime() + 3600_000)
          if (isToday(start, end)) {
            events.push({ title, start, end, allDay })
          }
        } catch {
          // skip malformed events
        }
      }
      continue
    }
    if (!inEvent) continue

    if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
      title = line.replace(/^SUMMARY[^:]*:/, '')
    } else if (line.startsWith('DTSTART;VALUE=DATE:')) {
      startRaw = line.replace('DTSTART;VALUE=DATE:', '')
      allDay = true
    } else if (line.startsWith('DTSTART')) {
      startRaw = line.replace(/^DTSTART[^:]*:/, '')
    } else if (line.startsWith('DTEND;VALUE=DATE:')) {
      endRaw = line.replace('DTEND;VALUE=DATE:', '')
    } else if (line.startsWith('DTEND')) {
      endRaw = line.replace(/^DTEND[^:]*:/, '')
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function parseCsv(text: string): CalendarEvent[] {
  if (!text.trim()) return []
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const titleIdx = header.indexOf('title')
  const startIdx = header.indexOf('start')
  const endIdx = header.indexOf('end')

  if (titleIdx === -1 || startIdx === -1) return []

  const events: CalendarEvent[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    try {
      const title = cols[titleIdx] ?? ''
      const start = new Date(cols[startIdx])
      const end = endIdx !== -1 && cols[endIdx] ? new Date(cols[endIdx]) : new Date(start.getTime() + 3600_000)
      if (isNaN(start.getTime())) continue
      if (isToday(start, end)) {
        events.push({ title, start, end, allDay: false })
      }
    } catch {
      // skip malformed rows
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function parseCalendarFeed(text: string): CalendarEvent[] {
  if (!text || !text.trim()) return []
  if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
    return parseIcs(text)
  }
  return parseCsv(text)
}
