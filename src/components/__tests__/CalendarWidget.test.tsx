import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CalendarWidget } from '../CalendarWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { saveSettings, DEFAULT_SETTINGS, DEFAULT_CALENDAR_COLORS } from '../../lib/settings'

function hexToRgb(hex: string) {
  const value = hex.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function formatIcsUtc(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

function renderWithSettings(
  calendarFeeds: { url: string; color: string }[] = [],
  overrides: Partial<typeof DEFAULT_SETTINGS> = {},
) {
  saveSettings({ ...DEFAULT_SETTINGS, ...overrides, calendarFeeds })
  return render(
    <SettingsProvider>
      <CalendarWidget />
    </SettingsProvider>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// Today's date for event matching
const TODAY = new Date()
const Y = TODAY.getFullYear()
const M = String(TODAY.getMonth() + 1).padStart(2, '0')
const D = String(TODAY.getDate()).padStart(2, '0')
const TOMORROW = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 1)
const TOMORROW_Y = TOMORROW.getFullYear()
const TOMORROW_M = String(TOMORROW.getMonth() + 1).padStart(2, '0')
const TOMORROW_D = String(TOMORROW.getDate()).padStart(2, '0')

const TODAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Team Standup
DTSTART:${Y}${M}${D}T090000Z
DTEND:${Y}${M}${D}T093000Z
END:VEVENT
END:VCALENDAR`

const ALL_DAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Focus Day
DTSTART;VALUE=DATE:${Y}${M}${D}
DTEND;VALUE=DATE:${TOMORROW_Y}${TOMORROW_M}${TOMORROW_D}
END:VEVENT
END:VCALENDAR`

const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recurring-team-sync
SUMMARY:Recurring Team Sync
DTSTART:${Y}${M}${D}T090000Z
DTEND:${Y}${M}${D}T093000Z
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`

describe('CalendarWidget', () => {
  it('shows the monthly overview by default', () => {
    renderWithSettings([])

    expect(screen.getByLabelText('Current month calendar')).toBeInTheDocument()
    expect(screen.getByText(new Date().toLocaleDateString(undefined, { month: 'short' }))).toBeInTheDocument()
    expect(screen.getByText(`${new Date().getFullYear()}.`)).toBeInTheDocument()
  })

  it('starts the calendar week on Monday by default', () => {
    renderWithSettings([])

    const monthCalendar = screen.getByLabelText('Current month calendar')
    const weekdayLabels = Array.from(monthCalendar.querySelectorAll('[class*="weekdayLabel"]')).map(
      (element) => element.textContent,
    )

    expect(weekdayLabels).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('can start the calendar week on Sunday', () => {
    renderWithSettings([], { calendarWeekStartsOn: 'sunday' })

    const monthCalendar = screen.getByLabelText('Current month calendar')
    const weekdayLabels = Array.from(monthCalendar.querySelectorAll('[class*="weekdayLabel"]')).map(
      (element) => element.textContent,
    )

    expect(weekdayLabels).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
  })

  it('hides the monthly overview when disabled in settings', () => {
    renderWithSettings([], { calendarShowMonthlyOverview: false })

    expect(screen.queryByLabelText('Current month calendar')).not.toBeInTheDocument()
  })

  it('shows "no calendar connected" when no URL is set', () => {
    renderWithSettings([])
    expect(screen.getByText(/No calendars connected/)).toBeInTheDocument()
  })

  it('shows loading while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    expect(screen.getByLabelText('Loading events')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('renders events after successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => TODAY_ICS }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getAllByText('Team Standup')[0]).toBeInTheDocument()
    const todayLabel = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    const todayCell = screen.getByLabelText(todayLabel)
    expect(todayCell.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(todayCell.textContent).toContain('Team Standup')
    vi.unstubAllGlobals()
  })

  it('renders all-day events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => ALL_DAY_ICS }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[1] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getAllByText('Focus Day')[0]).toBeInTheDocument()
    expect(screen.getAllByText('All day')[0]).toBeInTheDocument()
    expect(window.getComputedStyle(screen.getAllByText('Focus Day')[0].closest('li') as HTMLElement).color).toBe(
      hexToRgb(DEFAULT_CALENDAR_COLORS[1]),
    )
    vi.unstubAllGlobals()
  })

  it('hides all-day events when disabled in settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => ALL_DAY_ICS }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[1] }], {
      calendarShowAllDayEvents: false,
    })
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/No events today/)).toBeInTheDocument()
    expect(screen.queryAllByText('Focus Day')).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('renders recurring events for today', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => RECURRING_ICS }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[2] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getAllByText('Recurring Team Sync')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('highlights the ongoing event', async () => {
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 60_000)
    const end = new Date(now.getTime() + 30 * 60_000)
    const ongoingIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Ongoing Meeting
DTSTART:${formatIcsUtc(start)}
DTEND:${formatIcsUtc(end)}
END:VEVENT
END:VCALENDAR`

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => ongoingIcs }),
    )

    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())

    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getAllByText('Ongoing Meeting')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('highlights every ongoing event', async () => {
    const now = new Date()
    const firstStart = new Date(now.getTime() - 45 * 60_000)
    const firstEnd = new Date(now.getTime() + 15 * 60_000)
    const secondStart = new Date(now.getTime() - 10 * 60_000)
    const secondEnd = new Date(now.getTime() + 50 * 60_000)
    const overlappingIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:First Ongoing
DTSTART:${formatIcsUtc(firstStart)}
DTEND:${formatIcsUtc(firstEnd)}
END:VEVENT
BEGIN:VEVENT
SUMMARY:Second Ongoing
DTSTART:${formatIcsUtc(secondStart)}
DTEND:${formatIcsUtc(secondEnd)}
END:VEVENT
END:VCALENDAR`

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => overlappingIcs }),
    )

    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())

    expect(screen.getAllByText('Now')).toHaveLength(2)
    expect(screen.getAllByText('First Ongoing')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Second Ongoing')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('hides past events when disabled in settings', async () => {
    const pastIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Old Meeting
DTSTART:${Y}${M}${D}T070000Z
DTEND:${Y}${M}${D}T073000Z
END:VEVENT
END:VCALENDAR`

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => pastIcs }))

    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }], {
      calendarHidePastEvents: true,
    })
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/No events today/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('normalizes Google Calendar share links before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => TODAY_ICS })
    vi.stubGlobal('fetch', fetchMock)
    renderWithSettings([
      {
        url: 'https://calendar.google.com/calendar/u/0?cid=bWF0ZWlzdHZhbnZhcmdhQGdtYWlsLmNvbQ',
        color: DEFAULT_CALENDAR_COLORS[0],
      },
    ])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calendar?url=https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fmateistvanvarga%2540gmail.com%2Fpublic%2Fbasic.ics',
    )
    expect(screen.getAllByText('Team Standup')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('falls back after a failed proxy request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, text: async () => TODAY_ICS })
    vi.stubGlobal('fetch', fetchMock)
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/calendar?url=https%3A%2F%2Fexample.com%2Fcal.ics')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/cal.ics')
    expect(screen.getAllByText('Team Standup')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows empty state when feed has no events today', async () => {
    const emptyIcs = `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => emptyIcs }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/No events today/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load calendar/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error when server returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' }),
    )
    renderWithSettings([{ url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] }])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load calendar/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('merges events from multiple calendar feeds', async () => {
    const laterIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Client Call
DTSTART:${Y}${M}${D}T110000Z
DTEND:${Y}${M}${D}T113000Z
END:VEVENT
END:VCALENDAR`

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => TODAY_ICS })
        .mockResolvedValueOnce({ ok: true, text: async () => laterIcs }),
    )
    renderWithSettings([
      { url: 'https://example.com/one.ics', color: DEFAULT_CALENDAR_COLORS[0] },
      { url: 'https://example.com/two.ics', color: DEFAULT_CALENDAR_COLORS[1] },
    ])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getAllByText('Team Standup')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Client Call')[0]).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
