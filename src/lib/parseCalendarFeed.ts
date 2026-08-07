import ICAL, { type Event as ICalEvent } from 'ical.js'

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

function toCalendarEvent(title: string, start: Date, end: Date, allDay: boolean): CalendarEvent | null {
  return isToday(start, end) ? { title, start, end, allDay } : null
}

function isCancelledEvent(event: ICalEvent): boolean {
  return event.component.getFirstPropertyValue('status') === 'CANCELLED'
}

function parseRecurringEvent(event: ICalEvent, startOfDay: Date, endOfDay: Date): CalendarEvent[] {
  const iterator = event.iterator()
  const events: CalendarEvent[] = []

  for (let iterations = 0; iterations < 5000; iterations += 1) {
    const occurrenceTime = iterator.next()
    if (!occurrenceTime) break

    const details = event.getOccurrenceDetails(occurrenceTime)
    const start = details.startDate.toJSDate()
    if (start > endOfDay) break
    if (start < startOfDay) continue

    if (isCancelledEvent(details.item)) {
      continue
    }

    const nextEvent = toCalendarEvent(
      details.item.summary,
      start,
      details.endDate.toJSDate(),
      details.startDate.isDate,
    )

    if (nextEvent) {
      events.push(nextEvent)
    }
  }

  return events
}

export function parseIcs(text: string): CalendarEvent[] {
  if (!text || !text.includes('BEGIN:VEVENT')) return []

  try {
    const calendar = new ICAL.Component(ICAL.parse(text))
    const sourceEvents = calendar.getAllSubcomponents('vevent').map((component) => new ICAL.Event(component))
    const eventsByUid = new Map<string, ICalEvent>()
    const deferredExceptions: ICalEvent[] = []
    const calendarEvents: CalendarEvent[] = []
    const { startOfDay, endOfDay } = todayRange()

    for (const [index, event] of sourceEvents.entries()) {
      if (event.isRecurrenceException()) {
        const parentEvent = event.uid ? eventsByUid.get(event.uid) : undefined
        if (parentEvent) {
          parentEvent.relateException(event)
        } else {
          deferredExceptions.push(event)
        }
        continue
      }

      eventsByUid.set(event.uid || `event-${index}`, event)
    }

    for (const event of deferredExceptions) {
      const parentEvent = event.uid ? eventsByUid.get(event.uid) : undefined
      if (parentEvent) {
        parentEvent.relateException(event)
      } else {
        eventsByUid.set(`${event.uid}:${event.recurrenceId?.toString() ?? 'exception'}`, event)
      }
    }

    for (const event of eventsByUid.values()) {
      if (event.isRecurring()) {
        calendarEvents.push(...parseRecurringEvent(event, startOfDay, endOfDay))
        continue
      }

      if (isCancelledEvent(event)) {
        continue
      }

      const nextEvent = toCalendarEvent(
        event.summary,
        event.startDate.toJSDate(),
        event.endDate.toJSDate(),
        event.startDate.isDate,
      )

      if (nextEvent) {
        calendarEvents.push(nextEvent)
      }
    }

    return calendarEvents.sort((a, b) => a.start.getTime() - b.start.getTime())
  } catch {
    return []
  }
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
