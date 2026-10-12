import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CalendarWidget } from '../CalendarWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_CALENDAR_COLORS, DEFAULT_SETTINGS, saveSettings, type CalendarFeed } from '../../lib/settings'

function icsTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`
}

function calendar(...events: Array<{ title: string; start: Date; minutes?: number; uid?: string }>): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...events.flatMap(({ title, start, minutes = 30, uid }) => [
      'BEGIN:VEVENT',
      `UID:${uid ?? title}`,
      `SUMMARY:${title}`,
      `DTSTART:${icsTime(start)}`,
      `DTEND:${icsTime(new Date(start.getTime() + minutes * 60_000))}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n')
}

// Serves feeds by URL, both directly and through the local dev proxy.
function stubFeeds(feeds: Record<string, string | (() => Promise<string>)>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const requested = String(input)
    const url = requested.startsWith('/api/calendar?url=')
      ? decodeURIComponent(requested.slice('/api/calendar?url='.length))
      : requested
    const body = feeds[url]
    if (body === undefined) return { ok: false, status: 404, text: async () => '' }
    return { ok: true, text: typeof body === 'function' ? body : async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function feed(url: string, colorIndex = 0): CalendarFeed {
  return { url, color: DEFAULT_CALENDAR_COLORS[colorIndex] }
}

function renderCalendar(
  options: {
    feeds?: CalendarFeed[]
    globalFeeds?: CalendarFeed[]
    onAddNotification?: ReturnType<typeof vi.fn>
  } = {},
) {
  saveSettings({
    ...DEFAULT_SETTINGS,
    calendarFeeds: options.feeds ?? [],
    globalCalendarFeeds: options.globalFeeds ?? [],
  })
  return render(
    <SettingsProvider>
      <CalendarWidget onAddNotification={options.onAddNotification} />
    </SettingsProvider>,
  )
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('CalendarWidget behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0, 0))
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('reminders', () => {
    it('reminds about every event starting soon, not just the first', async () => {
      const soon = new Date(2026, 9, 12, 10, 10)
      stubFeeds({ 'https://example.com/a.ics': calendar({ title: 'Design review', start: soon }, { title: 'Hiring sync', start: soon }) })
      const onAddNotification = vi.fn()

      renderCalendar({ feeds: [feed('https://example.com/a.ics')], onAddNotification })

      await waitFor(() => expect(onAddNotification).toHaveBeenCalledTimes(2))
      const bodies = onAddNotification.mock.calls.map(([notification]) => notification.body)
      expect(bodies.some((body: string) => body.includes('Design review'))).toBe(true)
      expect(bodies.some((body: string) => body.includes('Hiring sync'))).toBe(true)
    })

    it('still reminds while another month is being viewed', async () => {
      const onAddNotification = vi.fn()
      stubFeeds({ 'https://example.com/a.ics': calendar({ title: 'Later today', start: new Date(2026, 9, 12, 10, 30) }) })

      renderCalendar({ feeds: [feed('https://example.com/a.ics')], onAddNotification })
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
      await advance(20 * 60_000)

      await waitFor(() => expect(onAddNotification).toHaveBeenCalledTimes(1))
      expect(onAddNotification.mock.calls[0][0].body).toContain('Later today')
    })

    it('does not repeat a reminder after the page reloads', async () => {
      stubFeeds({ 'https://example.com/a.ics': calendar({ title: 'Standup', start: new Date(2026, 9, 12, 10, 5) }) })
      const first = vi.fn()
      const { unmount } = renderCalendar({ feeds: [feed('https://example.com/a.ics')], onAddNotification: first })
      await waitFor(() => expect(first).toHaveBeenCalledTimes(1))
      unmount()

      const second = vi.fn()
      renderCalendar({ feeds: [feed('https://example.com/a.ics')], onAddNotification: second })
      await advance(2_000)

      expect(second).not.toHaveBeenCalled()
    })
  })

  it('moves "today" to the new day at midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 23, 59, 30))
    stubFeeds({ 'https://example.com/a.ics': calendar({ title: 'Tomorrow breakfast', start: new Date(2026, 9, 13, 8, 0) }) })

    renderCalendar({ feeds: [feed('https://example.com/a.ics')] })
    await advance(1_000)
    expect(screen.queryByText('Tomorrow breakfast')).not.toBeInTheDocument()

    await advance(61_000)
    await waitFor(() => expect(screen.getByText('Tomorrow breakfast')).toBeInTheDocument())
  })

  it('refreshes feeds periodically and keeps showing events while refreshing', async () => {
    let refreshCount = 0
    const fetchMock = stubFeeds({
      'https://example.com/a.ics': () => {
        refreshCount += 1
        // The first load succeeds; refreshes hang to show the old events stay.
        return refreshCount === 1
          ? Promise.resolve(calendar({ title: 'Planning', start: new Date(2026, 9, 12, 14, 0) }))
          : new Promise<string>(() => {})
      },
    })

    renderCalendar({ feeds: [feed('https://example.com/a.ics')] })
    await waitFor(() => expect(screen.getByText('Planning')).toBeInTheDocument())
    const initialCalls = fetchMock.mock.calls.length

    await advance(16 * 60_000)

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls)
    expect(screen.getByText('Planning')).toBeInTheDocument()
  })

  it('goes from January 31 to February, not March', () => {
    vi.setSystemTime(new Date(2026, 0, 31, 10, 0))
    renderCalendar()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

    expect(screen.getByText(/Feb 2026/)).toBeInTheDocument()
  })

  it('goes from March 31 back to February', () => {
    vi.setSystemTime(new Date(2026, 2, 31, 10, 0))
    renderCalendar()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(screen.getByText(/Feb 2026/)).toBeInTheDocument()
  })

  it('shows a feed that is set both globally and in the preset only once', async () => {
    const fetchMock = stubFeeds({ 'https://example.com/a.ics': calendar({ title: 'Retro', start: new Date(2026, 9, 12, 15, 0) }) })

    renderCalendar({ feeds: [feed('https://example.com/a.ics')], globalFeeds: [feed('https://example.com/a.ics', 1)] })

    await waitFor(() => expect(screen.getByText('Retro')).toBeInTheDocument())
    expect(screen.getAllByText('Retro')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows the same meeting from two calendars without key collisions', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const meeting = { title: 'All hands', start: new Date(2026, 9, 12, 16, 0) }
    stubFeeds({
      'https://example.com/work.ics': calendar({ ...meeting, uid: 'work-1' }),
      'https://example.com/team.ics': calendar({ ...meeting, uid: 'team-1' }),
    })

    renderCalendar({ feeds: [feed('https://example.com/work.ics'), feed('https://example.com/team.ics', 1)] })

    await waitFor(() => expect(screen.getAllByText('All hands')).toHaveLength(2))
    const keyWarnings = consoleError.mock.calls.filter((args) => String(args[0]).includes('same key'))
    expect(keyWarnings).toEqual([])
  })
})
