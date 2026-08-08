import ICAL, { type Event as ICalEvent } from 'ical.js'

export interface CalendarEvent {
  title: string
  start: Date
  end: Date
  allDay: boolean
  calendarColor?: string
}

export interface CalendarRange {
  start: Date
  end: Date
}

function dayRange(referenceDate = new Date()): CalendarRange {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  )
  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999,
  )
  return { start, end }
}

function isInRange(start: Date, end: Date, range: CalendarRange): boolean {
  return start <= range.end && end >= range.start
}

function toCalendarEvent(
  title: string,
  start: Date,
  end: Date,
  allDay: boolean,
  range: CalendarRange,
): CalendarEvent | null {
  return isInRange(start, end, range) ? { title, start, end, allDay } : null
}

function isCancelledEvent(event: ICalEvent): boolean {
  return event.component.getFirstPropertyValue('status') === 'CANCELLED'
}

function parseRecurringEvent(event: ICalEvent, range: CalendarRange): CalendarEvent[] {
  const iterator = event.iterator()
  const events: CalendarEvent[] = []

  for (let iterations = 0; iterations < 5000; iterations += 1) {
    const occurrenceTime = iterator.next()
    if (!occurrenceTime) break

    const details = event.getOccurrenceDetails(occurrenceTime)
    const start = details.startDate.toJSDate()
    if (start > range.end) break
    if (start < range.start) continue

    if (isCancelledEvent(details.item)) {
      continue
    }

    const nextEvent = toCalendarEvent(
      details.item.summary,
      start,
      details.endDate.toJSDate(),
      details.startDate.isDate,
      range,
    )

    if (nextEvent) {
      events.push(nextEvent)
    }
  }

  return events
}

export function parseIcs(text: string, range = dayRange()): CalendarEvent[] {
  if (!text || !text.includes('BEGIN:VEVENT')) return []

  try {
    const calendar = new ICAL.Component(ICAL.parse(text))
    const sourceEvents = calendar.getAllSubcomponents('vevent').map((component) => new ICAL.Event(component))
    const eventsByUid = new Map<string, ICalEvent>()
    const deferredExceptions: ICalEvent[] = []
    const calendarEvents: CalendarEvent[] = []

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
        calendarEvents.push(...parseRecurringEvent(event, range))
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
        range,
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

export function parseCsv(text: string, range = dayRange()): CalendarEvent[] {
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
      if (isInRange(start, end, range)) {
        events.push({ title, start, end, allDay: false })
      }
    } catch {
      // skip malformed rows
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function parseCalendarFeed(text: string, range = dayRange()): CalendarEvent[] {
  if (!text || !text.trim()) return []
  if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
    return parseIcs(text, range)
  }
  return parseCsv(text, range)
}
