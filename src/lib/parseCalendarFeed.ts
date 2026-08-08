import ICAL, { type Event as ICalEvent, type Property as ICalProperty } from 'ical.js'

export interface CalendarPerson {
  name: string
  email?: string
  responseStatus?: string
}

export interface CalendarEvent {
  title: string
  start: Date
  end: Date
  allDay: boolean
  eventUrl?: string
  notes?: string
  location?: string
  organizer?: CalendarPerson
  attendees?: CalendarPerson[]
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

function normalizeTextValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.replace(/\r\n?/g, '\n').trim()
  return trimmedValue ? trimmedValue : undefined
}

function normalizeEventUrl(value: unknown): string | undefined {
  const trimmedValue = normalizeTextValue(value)
  if (!trimmedValue) {
    return undefined
  }

  try {
    const url = new URL(trimmedValue)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    return url.toString()
  } catch {
    return undefined
  }
}

function extractFirstHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const match = value.match(/https?:\/\/[^\s<>"')]+/i)
  return match ? normalizeEventUrl(match[0]) : undefined
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeContactValue(value: unknown): string | undefined {
  const trimmedValue = normalizeTextValue(value)
  if (!trimmedValue) {
    return undefined
  }

  return trimmedValue.toLowerCase().startsWith('mailto:') ? trimmedValue.slice('mailto:'.length) : trimmedValue
}

function getEventNotes(event: ICalEvent): string | undefined {
  const plainDescription = normalizeTextValue(event.component.getFirstPropertyValue('description'))
  if (plainDescription) {
    return plainDescription
  }

  const htmlDescription = normalizeTextValue(event.component.getFirstPropertyValue('x-alt-desc'))
  return htmlDescription ? stripHtml(htmlDescription) : undefined
}

function parsePersonProperty(property: ICalProperty | null): CalendarPerson | undefined {
  if (!property) {
    return undefined
  }

  const email = normalizeContactValue(property.getFirstValue())
  const name = normalizeTextValue(property.getParameter('cn')) ?? email
  if (!name) {
    return undefined
  }

  const responseStatus = normalizeTextValue(property.getParameter('partstat'))

  return {
    name,
    ...(email && email !== name ? { email } : {}),
    ...(responseStatus ? { responseStatus } : {}),
  }
}

function getEventAttendees(event: ICalEvent): CalendarPerson[] | undefined {
  const attendees = event.component
    .getAllProperties('attendee')
    .map((property) => parsePersonProperty(property))
    .filter((attendee): attendee is CalendarPerson => attendee !== undefined)

  return attendees.length > 0 ? attendees : undefined
}

function getEventUrl(event: ICalEvent): string | undefined {
  const directUrl = normalizeEventUrl(event.component.getFirstPropertyValue('url'))

  if (directUrl) {
    return directUrl
  }

  const descriptionUrl = extractFirstHttpUrl(event.component.getFirstPropertyValue('description'))
  if (descriptionUrl) {
    return descriptionUrl
  }

  const htmlDescriptionUrl = extractFirstHttpUrl(event.component.getFirstPropertyValue('x-alt-desc'))
  if (htmlDescriptionUrl) {
    return htmlDescriptionUrl
  }

  const locationUrl = extractFirstHttpUrl(event.component.getFirstPropertyValue('location'))
  if (locationUrl) {
    return locationUrl
  }

  return extractFirstHttpUrl(event.component.getFirstPropertyValue('attach'))
}

function getEventMetadata(event: ICalEvent): Pick<
  CalendarEvent,
  'eventUrl' | 'notes' | 'location' | 'organizer' | 'attendees'
> {
  return {
    eventUrl: getEventUrl(event),
    notes: getEventNotes(event),
    location: normalizeTextValue(event.component.getFirstPropertyValue('location')),
    organizer: parsePersonProperty(event.component.getFirstProperty('organizer')),
    attendees: getEventAttendees(event),
  }
}

function toCalendarEvent(
  title: string,
  start: Date,
  end: Date,
  allDay: boolean,
  metadata: Pick<CalendarEvent, 'eventUrl' | 'notes' | 'location' | 'organizer' | 'attendees'>,
  range: CalendarRange,
): CalendarEvent | null {
  return isInRange(start, end, range) ? { title, start, end, allDay, ...metadata } : null
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
      getEventMetadata(details.item),
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
        getEventMetadata(event),
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
  const urlIdx = header.indexOf('url')
  const linkIdx = header.indexOf('link')
  const locationIdx = header.indexOf('location')
  const descriptionIdx = header.indexOf('description')
  const notesIdx = header.indexOf('notes')
  const guestsIdx = header.indexOf('guests')
  const inviteesIdx = header.indexOf('invitees')
  const organizerIdx = header.indexOf('organizer')

  if (titleIdx === -1 || startIdx === -1) return []

  const events: CalendarEvent[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    try {
      const title = cols[titleIdx] ?? ''
      const start = new Date(cols[startIdx])
      const end = endIdx !== -1 && cols[endIdx] ? new Date(cols[endIdx]) : new Date(start.getTime() + 3600_000)
      const rawUrl =
        urlIdx !== -1 ? cols[urlIdx]
        : linkIdx !== -1 ? cols[linkIdx]
        : locationIdx !== -1 ? extractFirstHttpUrl(cols[locationIdx])
        : descriptionIdx !== -1 ? extractFirstHttpUrl(cols[descriptionIdx])
        : undefined
      const eventUrl = normalizeEventUrl(rawUrl)
      const location = locationIdx !== -1 ? normalizeTextValue(cols[locationIdx]) : undefined
      const notes =
        notesIdx !== -1 ? normalizeTextValue(cols[notesIdx])
        : descriptionIdx !== -1 ? normalizeTextValue(cols[descriptionIdx])
        : undefined
      const attendeeNames =
        guestsIdx !== -1 ? cols[guestsIdx]
        : inviteesIdx !== -1 ? cols[inviteesIdx]
        : undefined
      const attendees = attendeeNames
        ?.split(/[;|]/)
        .map((entry) => normalizeTextValue(entry))
        .filter((entry): entry is string => Boolean(entry))
        .map((name) => ({ name }))
      const organizerName = organizerIdx !== -1 ? normalizeTextValue(cols[organizerIdx]) : undefined
      if (isNaN(start.getTime())) continue
      if (isInRange(start, end, range)) {
        events.push({
          title,
          start,
          end,
          allDay: false,
          eventUrl,
          location,
          notes,
          ...(organizerName ? { organizer: { name: organizerName } } : {}),
          ...(attendees && attendees.length > 0 ? { attendees } : {}),
        })
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
