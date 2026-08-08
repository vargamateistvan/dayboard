import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseCalendarFeed, parseIcs, parseCsv } from '../parseCalendarFeed'

// Fix "today" to a known date so tests are deterministic
const FIXED_DATE = new Date('2024-08-07T12:00:00')
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
})
afterAll(() => vi.useRealTimers())

const TODAY_ICS_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Stand-up
DTSTART:20240807T090000Z
DTEND:20240807T093000Z
END:VEVENT
END:VCALENDAR`

const TOMORROW_ICS_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Tomorrow meeting
DTSTART:20240808T100000Z
DTEND:20240808T110000Z
END:VEVENT
END:VCALENDAR`

const MULTI_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Morning sync
DTSTART:20240807T080000Z
DTEND:20240807T083000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Lunch
DTSTART:20240807T120000Z
DTEND:20240807T130000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Next week
DTSTART:20240814T100000Z
DTEND:20240814T110000Z
END:VEVENT
END:VCALENDAR`

const ALL_DAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Office Day
DTSTART;VALUE=DATE:20240807
DTEND;VALUE=DATE:20240808
END:VEVENT
END:VCALENDAR`

const ALL_DAY_WITH_EXTRA_PARAMS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Bank Holiday
DTSTART;VALUE=DATE;X-MICROSOFT-CDO-ALLDAYEVENT=TRUE:20240807
END:VEVENT
END:VCALENDAR`

const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-standup
SUMMARY:Recurring Stand-up
DTSTART:20240731T090000Z
DTEND:20240731T093000Z
RRULE:FREQ=WEEKLY;BYDAY=WE
END:VEVENT
END:VCALENDAR`

const RECURRING_WITH_EXDATE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-sync
SUMMARY:Daily Sync
DTSTART:20240801T090000Z
DTEND:20240801T093000Z
RRULE:FREQ=DAILY
EXDATE:20240807T090000Z
END:VEVENT
END:VCALENDAR`

const RECURRING_WITH_CANCELLED_EXCEPTION_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-cancelled
SUMMARY:Cancelled Today
DTSTART:20240801T090000Z
DTEND:20240801T093000Z
RRULE:FREQ=DAILY
END:VEVENT
BEGIN:VEVENT
UID:daily-cancelled
RECURRENCE-ID:20240807T090000Z
STATUS:CANCELLED
DTSTART:20240807T090000Z
DTEND:20240807T093000Z
SUMMARY:Cancelled Today
END:VEVENT
END:VCALENDAR`

const TODAY_CSV = `title,start,end
Stand-up,2024-08-07T09:00:00,2024-08-07T09:30:00`

const MULTI_CSV = `title,start,end
Morning sync,2024-08-07T08:00:00,2024-08-07T08:30:00
Lunch,2024-08-07T12:00:00,2024-08-07T13:00:00
Tomorrow,2024-08-08T10:00:00,2024-08-08T11:00:00`

describe('parseCalendarFeed — ICS', () => {
  it('parses a single event for today', () => {
    const events = parseIcs(TODAY_ICS_EVENT)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Stand-up')
  })

  it('filters out events not happening today', () => {
    const events = parseIcs(TOMORROW_ICS_EVENT)
    expect(events).toHaveLength(0)
  })

  it('returns only today events from multi-event ICS', () => {
    const events = parseIcs(MULTI_EVENT_ICS)
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.title)).toEqual(['Morning sync', 'Lunch'])
  })

  it('parses all-day events for today', () => {
    const events = parseIcs(ALL_DAY_ICS)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Office Day')
    expect(events[0].allDay).toBe(true)
  })

  it('parses all-day events when VALUE=DATE has extra parameters', () => {
    const events = parseIcs(ALL_DAY_WITH_EXTRA_PARAMS_ICS)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Bank Holiday')
    expect(events[0].allDay).toBe(true)
  })

  it('expands recurring events for today', () => {
    const events = parseIcs(RECURRING_ICS)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Recurring Stand-up')
    expect(events[0].allDay).toBe(false)
  })

  it('omits recurring occurrences excluded by EXDATE', () => {
    expect(parseIcs(RECURRING_WITH_EXDATE_ICS)).toEqual([])
  })

  it('omits recurring occurrences cancelled by exception records', () => {
    expect(parseIcs(RECURRING_WITH_CANCELLED_EXCEPTION_ICS)).toEqual([])
  })

  it('returns events sorted by start time', () => {
    const events = parseIcs(MULTI_EVENT_ICS)
    expect(events[0].start.getTime()).toBeLessThan(events[1].start.getTime())
  })

  it('returns empty array for empty input', () => {
    expect(parseIcs('')).toEqual([])
  })

  it('returns empty array for malformed ICS without crashing', () => {
    expect(parseIcs('not ics content at all')).toEqual([])
  })
})

describe('parseCalendarFeed — CSV', () => {
  it('parses a single event for today', () => {
    const events = parseCsv(TODAY_CSV)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Stand-up')
  })

  it('filters out events not happening today', () => {
    const events = parseCsv(MULTI_CSV)
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.title)).toEqual(['Morning sync', 'Lunch'])
  })

  it('returns empty array for empty string', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('returns empty array for header-only CSV', () => {
    expect(parseCsv('title,start,end')).toEqual([])
  })

  it('skips rows with invalid dates without crashing', () => {
    const csv = `title,start,end\nBad event,not-a-date,also-bad`
    expect(parseCsv(csv)).toEqual([])
  })
})

describe('parseCalendarFeed — auto-detection', () => {
  it('routes ICS content to ICS parser', () => {
    const events = parseCalendarFeed(TODAY_ICS_EVENT)
    expect(events).toHaveLength(1)
  })

  it('routes CSV content to CSV parser', () => {
    const events = parseCalendarFeed(TODAY_CSV)
    expect(events).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(parseCalendarFeed('')).toEqual([])
  })

  it('can parse events across a supplied month range', () => {
    const events = parseCalendarFeed(MULTI_EVENT_ICS, {
      start: new Date('2024-08-01T00:00:00'),
      end: new Date('2024-08-31T23:59:59'),
    })

    expect(events.map((event) => event.title)).toEqual([
      'Morning sync',
      'Lunch',
      'Next week',
    ])
  })
})
