import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCalendarFeed, fetchCalendarFeeds, getCalendarFeedRequestUrls } from '../fetchCalendarFeed'
import { DEFAULT_CALENDAR_COLORS } from '../settings'

describe('getCalendarFeedRequestUrls', () => {
  it('uses the local proxy first on localhost', () => {
    expect(
      getCalendarFeedRequestUrls(
        'https://calendar.google.com/calendar/embed?src=mateistvanvarga%40gmail.com&ctz=Europe%2FBudapest',
        'localhost',
      ),
    ).toEqual([
      '/api/calendar?url=https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fmateistvanvarga%2540gmail.com%2Fpublic%2Fbasic.ics',
      'https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
    ])
  })

  it('prefers the mirror for Google Calendar feeds away from localhost', () => {
    expect(
      getCalendarFeedRequestUrls(
        'https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
        'dayboard.app',
      ),
    ).toEqual([
    'https://r.jina.ai/http://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
    'https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
    ])
  })

  it('tries the original URL before the mirror for non-Google feeds away from localhost', () => {
    expect(
    getCalendarFeedRequestUrls(
      'https://example.com/calendar.ics',
      'dayboard.app',
    ),
    ).toEqual([
    'https://example.com/calendar.ics',
    'https://r.jina.ai/http://example.com/calendar.ics',
    ])
  })
})

describe('fetchCalendarFeed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the first successful response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => 'BEGIN:VCALENDAR' }),
    )

    await expect(fetchCalendarFeed('https://example.com/calendar.ics')).resolves.toBe('BEGIN:VCALENDAR')
  })

  it('extracts the ICS payload from mirrored responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Title: Feed\n\nMarkdown Content:\nBEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n',
      }),
    )

    await expect(
      fetchCalendarFeed('https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics'),
    ).resolves.toBe('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR')
  })

  it('falls back to the direct URL when the local proxy fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, text: async () => 'BEGIN:VCALENDAR' })

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCalendarFeed('https://example.com/calendar.ics')).resolves.toBe('BEGIN:VCALENDAR')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/calendar?url=https%3A%2F%2Fexample.com%2Fcalendar.ics')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/calendar.ics')
  })

  it('retries after a network error before surfacing an error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new Error('proxy unavailable'))

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCalendarFeed('https://example.com/calendar.ics')).rejects.toThrow('proxy unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('fetchCalendarFeeds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all successful feed bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => 'BEGIN:VCALENDAR\nSUMMARY:A' })
        .mockResolvedValueOnce({ ok: true, text: async () => 'BEGIN:VCALENDAR\nSUMMARY:B' }),
    )

    await expect(fetchCalendarFeeds([
      { url: 'https://example.com/one.ics', color: DEFAULT_CALENDAR_COLORS[0] },
      { url: 'https://example.com/two.ics', color: DEFAULT_CALENDAR_COLORS[1] },
    ])).resolves.toEqual([
      {
        feed: { url: 'https://example.com/one.ics', color: DEFAULT_CALENDAR_COLORS[0] },
        text: 'BEGIN:VCALENDAR\nSUMMARY:A',
      },
      {
        feed: { url: 'https://example.com/two.ics', color: DEFAULT_CALENDAR_COLORS[1] },
        text: 'BEGIN:VCALENDAR\nSUMMARY:B',
      },
    ])
  })

  it('returns successful feeds when one feed fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockRejectedValueOnce(new Error('first failed'))
        .mockRejectedValueOnce(new Error('second fallback failed'))
        .mockResolvedValueOnce({ ok: true, text: async () => 'BEGIN:VCALENDAR\nSUMMARY:B' }),
    )

    await expect(fetchCalendarFeeds([
      { url: 'https://example.com/one.ics', color: DEFAULT_CALENDAR_COLORS[0] },
      { url: 'https://example.com/two.ics', color: DEFAULT_CALENDAR_COLORS[1] },
      { url: 'https://example.com/three.ics', color: DEFAULT_CALENDAR_COLORS[2] },
    ])).resolves.toEqual([
      {
        feed: { url: 'https://example.com/three.ics', color: DEFAULT_CALENDAR_COLORS[2] },
        text: 'BEGIN:VCALENDAR\nSUMMARY:B',
      },
    ])
  })
})
