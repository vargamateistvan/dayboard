import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CalendarWidget } from '../CalendarWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { saveSettings, DEFAULT_SETTINGS } from '../../lib/settings'

function renderWithSettings(calendarUrl = '') {
  saveSettings({ ...DEFAULT_SETTINGS, calendarUrl })
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

const TODAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Team Standup
DTSTART:${Y}${M}${D}T090000Z
DTEND:${Y}${M}${D}T093000Z
END:VEVENT
END:VCALENDAR`

describe('CalendarWidget', () => {
  it('shows "no calendar connected" when no URL is set', () => {
    renderWithSettings('')
    expect(screen.getByText(/No calendar connected/)).toBeInTheDocument()
  })

  it('shows loading while fetching', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    renderWithSettings('https://example.com/cal.ics')
    expect(screen.getByLabelText('Loading events')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('renders events after successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => TODAY_ICS }),
    )
    renderWithSettings('https://example.com/cal.ics')
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows empty state when feed has no events today', async () => {
    const emptyIcs = `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => emptyIcs }),
    )
    renderWithSettings('https://example.com/cal.ics')
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/No events today/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    renderWithSettings('https://example.com/cal.ics')
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load calendar/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('shows error when server returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => '' }),
    )
    renderWithSettings('https://example.com/cal.ics')
    await waitFor(() => expect(screen.queryByLabelText('Loading events')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load calendar/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
