import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CalendarWidget } from '../CalendarWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { saveSettings, DEFAULT_SETTINGS } from '../../lib/settings'

function renderWithSettings(calendarUrls: string[] = []) {
  saveSettings({ ...DEFAULT_SETTINGS, calendarUrls })
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

describe('CalendarWidget', () => {
  it('shows "no calendar connected" when no URL is set', () => {
    renderWithSettings([])
    expect(screen.getByText(/No calendars connected/)).toBeInTheDocument()
  })

  it('shows loading while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    renderWithSettings(['https://example.com/cal.ics'])
    expect(screen.getByLabelText('Loading events')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('renders events after successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => TODAY_ICS }),
    )
    renderWithSettings(['https://example.com/cal.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('renders all-day events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => ALL_DAY_ICS }),
    )
    renderWithSettings(['https://example.com/cal.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText('Focus Day')).toBeInTheDocument()
    expect(screen.getByText('All day')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('normalizes Google Calendar share links before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => TODAY_ICS })
    vi.stubGlobal('fetch', fetchMock)
    renderWithSettings(['https://calendar.google.com/calendar/u/0?cid=bWF0ZWlzdHZhbnZhcmdhQGdtYWlsLmNvbQ'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calendar?url=https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fmateistvanvarga%2540gmail.com%2Fpublic%2Fbasic.ics',
    )
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('falls back after a failed proxy request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, text: async () => TODAY_ICS })
    vi.stubGlobal('fetch', fetchMock)
    renderWithSettings(['https://example.com/cal.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/calendar?url=https%3A%2F%2Fexample.com%2Fcal.ics')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/cal.ics')
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows empty state when feed has no events today', async () => {
    const emptyIcs = `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => emptyIcs }),
    )
    renderWithSettings(['https://example.com/cal.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/No events today/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    renderWithSettings(['https://example.com/cal.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load calendar/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error when server returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' }),
    )
    renderWithSettings(['https://example.com/cal.ics'])
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
    renderWithSettings(['https://example.com/one.ics', 'https://example.com/two.ics'])
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    expect(screen.getByText('Client Call')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
