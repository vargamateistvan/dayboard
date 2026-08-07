import { describe, expect, it } from 'vitest'
import { normalizeCalendarUrl } from '../calendarUrl'

describe('normalizeCalendarUrl', () => {
  it('keeps ICS URLs unchanged', () => {
    expect(normalizeCalendarUrl('https://example.com/calendar.ics')).toBe('https://example.com/calendar.ics')
  })

  it('keeps Google Calendar ICS URLs unchanged', () => {
    expect(
      normalizeCalendarUrl('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics'),
    ).toBe('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics')
  })

  it('converts Google Calendar cid links to public ICS feeds', () => {
    expect(
      normalizeCalendarUrl('https://calendar.google.com/calendar/u/0?cid=bWF0ZWlzdHZhbnZhcmdhQGdtYWlsLmNvbQ'),
    ).toBe('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics')
  })

  it('converts Google Calendar src links to public ICS feeds', () => {
    expect(
      normalizeCalendarUrl('https://calendar.google.com/calendar/embed?src=mateistvanvarga%40gmail.com'),
    ).toBe('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics')
  })

  it('converts Google Calendar embed links with timezone params to public ICS feeds', () => {
    expect(
      normalizeCalendarUrl(
        'https://calendar.google.com/calendar/embed?src=mateistvanvarga%40gmail.com&ctz=Europe%2FBudapest',
      ),
    ).toBe('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics')
  })

  it('leaves non-Google calendar URLs unchanged', () => {
    expect(normalizeCalendarUrl('https://outlook.office.com/calendar/view')).toBe(
      'https://outlook.office.com/calendar/view',
    )
  })
})
