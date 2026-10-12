import { describe, expect, it } from 'vitest'
import { parseCsv, parseIcs } from '../parseCalendarFeed'

// Monday, Oct 12 2026, local time.
const TODAY = {
  start: new Date(2026, 9, 12, 0, 0, 0, 0),
  end: new Date(2026, 9, 12, 23, 59, 59, 999),
}

function ics(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n')
}

function vevent(lines: string[]): string {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n')
}

function titles(text: string, range = TODAY): string[] {
  return parseIcs(text, range).map((event) => event.title)
}

describe('parseIcs recurring events', () => {
  it('expands a daily event that started many years ago', () => {
    const feed = ics(vevent(['UID:old-daily', 'SUMMARY:Standup', 'DTSTART:20100101T090000', 'DTEND:20100101T091500', 'RRULE:FREQ=DAILY']))

    const events = parseIcs(feed, TODAY)

    expect(events).toHaveLength(1)
    expect(events[0].start).toEqual(new Date(2026, 9, 12, 9, 0))
  })

  it('includes an occurrence that starts before the range and runs into it', () => {
    const feed = ics(
      vevent(['UID:late', 'SUMMARY:Late shift', 'DTSTART:20261004T220000', 'DTEND:20261005T020000', 'RRULE:FREQ=WEEKLY']),
    )

    expect(titles(feed)).toEqual(['Late shift'])
  })

  it('keeps today when an earlier occurrence was moved to a later day', () => {
    const feed = ics(
      vevent(['UID:daily', 'SUMMARY:Daily', 'DTSTART:20261001T090000', 'DTEND:20261001T093000', 'RRULE:FREQ=DAILY']),
      vevent([
        'UID:daily',
        'SUMMARY:Daily (moved)',
        'RECURRENCE-ID:20261011T090000',
        'DTSTART:20261013T090000',
        'DTEND:20261013T093000',
      ]),
    )

    expect(titles(feed)).toEqual(['Daily'])
  })

  it('includes a later occurrence that was moved into the range', () => {
    const feed = ics(
      vevent(['UID:daily', 'SUMMARY:Daily', 'DTSTART:20261001T090000', 'DTEND:20261001T093000', 'RRULE:FREQ=DAILY']),
      vevent([
        'UID:daily',
        'SUMMARY:MovedIn',
        'RECURRENCE-ID:20261014T090000',
        'DTSTART:20261012T150000',
        'DTEND:20261012T153000',
      ]),
    )

    expect(titles(feed)).toEqual(['Daily', 'MovedIn'])
  })

  it('skips a cancelled occurrence', () => {
    const feed = ics(
      vevent(['UID:daily', 'SUMMARY:Daily', 'DTSTART:20261001T090000', 'DTEND:20261001T093000', 'RRULE:FREQ=DAILY']),
      vevent([
        'UID:daily',
        'SUMMARY:Daily',
        'RECURRENCE-ID:20261012T090000',
        'DTSTART:20261012T090000',
        'DTEND:20261012T093000',
        'STATUS:CANCELLED',
      ]),
    )

    expect(titles(feed)).toEqual([])
  })

  it('does not show a recurring all-day event on the day after it', () => {
    const feed = ics(
      vevent([
        'UID:weekly-allday',
        'SUMMARY:Sunday off',
        'DTSTART;VALUE=DATE:20261004',
        'DTEND;VALUE=DATE:20261005',
        'RRULE:FREQ=WEEKLY',
      ]),
    )

    expect(titles(feed)).toEqual([])
  })
})

describe('parseIcs end times are exclusive', () => {
  it('does not show yesterday’s all-day event today', () => {
    const feed = ics(vevent(['UID:a', 'SUMMARY:Yesterday', 'DTSTART;VALUE=DATE:20261011', 'DTEND;VALUE=DATE:20261012']))
    expect(titles(feed)).toEqual([])
  })

  it('does not show an event ending exactly at midnight on the next day', () => {
    const feed = ics(vevent(['UID:b', 'SUMMARY:Late', 'DTSTART:20261011T230000', 'DTEND:20261012T000000']))
    expect(titles(feed)).toEqual([])
  })

  it('still shows today’s all-day event', () => {
    const feed = ics(vevent(['UID:c', 'SUMMARY:Today', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261013']))
    expect(titles(feed)).toEqual(['Today'])
  })
})

describe('parseIcs time zones', () => {
  const WIDE = { start: new Date('2026-10-10T00:00:00Z'), end: new Date('2026-10-15T00:00:00Z') }

  it('uses the TZID even when the feed has no VTIMEZONE for it', () => {
    const feed = ics(
      vevent([
        'UID:ny',
        'SUMMARY:NY meeting',
        'DTSTART;TZID=America/New_York:20261012T090000',
        'DTEND;TZID=America/New_York:20261012T100000',
      ]),
    )

    const [event] = parseIcs(feed, WIDE)
    expect(event.start.toISOString()).toBe('2026-10-12T13:00:00.000Z')
    expect(event.end.toISOString()).toBe('2026-10-12T14:00:00.000Z')
  })

  it('applies a missing TZID to recurring occurrences across a DST change', () => {
    const feed = ics(
      vevent([
        'UID:ny-weekly',
        'SUMMARY:Weekly NY',
        'DTSTART;TZID=America/New_York:20261026T090000',
        'DTEND;TZID=America/New_York:20261026T100000',
        'RRULE:FREQ=WEEKLY;COUNT=2',
      ]),
    )

    const events = parseIcs(feed, { start: new Date('2026-10-20T00:00:00Z'), end: new Date('2026-11-10T00:00:00Z') })
    // EDT (UTC-4) before Nov 1 2026, EST (UTC-5) after.
    expect(events.map((event) => event.start.toISOString())).toEqual([
      '2026-10-26T13:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
    ])
  })
})

describe('parseCsv', () => {
  it('treats a date without a time as a local all-day event', () => {
    const [event] = parseCsv('Title,Start\nHoliday,2026-10-12', TODAY)

    expect(event.allDay).toBe(true)
    expect(event.start).toEqual(new Date(2026, 9, 12))
    expect(event.end).toEqual(new Date(2026, 9, 13))
  })

  it('does not show a date-only row on the previous day', () => {
    const yesterday = { start: new Date(2026, 9, 11), end: new Date(2026, 9, 11, 23, 59, 59, 999) }
    expect(parseCsv('Title,Start\nHoliday,2026-10-12', yesterday)).toEqual([])
  })
})
