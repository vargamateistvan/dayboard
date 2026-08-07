import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCalendarFeed, getCalendarFeedRequestUrls } from '../fetchCalendarFeed'

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

  it('uses public proxy fallbacks away from localhost', () => {
    expect(
      getCalendarFeedRequestUrls(
        'https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
        'dayboard.app',
      ),
    ).toEqual([
      'https://calendar.google.com/calendar/ical/mateistvanvarga%40gmail.com/public/basic.ics',
      'https://api.allorigins.win/raw?url=https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fmateistvanvarga%2540gmail.com%2Fpublic%2Fbasic.ics',
      'https://corsproxy.io/?https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Fical%2Fmateistvanvarga%2540gmail.com%2Fpublic%2Fbasic.ics',
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
