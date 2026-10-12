import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRecentLeagueScores, parseEventStatus, resetSportsApiCacheForTests, toEventTimestamp } from '../sports'

function event(overrides: Record<string, unknown> = {}) {
  return {
    idEvent: '1',
    strHomeTeam: 'Arsenal',
    strAwayTeam: 'Chelsea',
    intHomeScore: '2',
    intAwayScore: '1',
    strStatus: 'Match Finished',
    strTimestamp: '2026-10-10T11:30:00',
    dateEvent: '2026-10-10',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status === 200,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  }
}

describe('sports reliability', () => {
  beforeEach(() => {
    resetSportsApiCacheForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetSportsApiCacheForTests()
  })

  it('keeps the leagues that loaded when another league fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('eventspastleague.php?id=4328')) return jsonResponse({ events: [event()] })
        if (url.includes('eventspastleague.php')) return jsonResponse({}, 500)
        return jsonResponse({ teams: [] })
      }),
    )

    const scores = await fetchRecentLeagueScores(['EPL', 'LALIGA'], 4)

    expect(scores.map((score) => score.leagueId)).toEqual(['EPL'])
  })

  it('still fails when every league fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 500)))

    await expect(fetchRecentLeagueScores(['EPL', 'LALIGA'], 4)).rejects.toThrow()
  })

  it('waits for Retry-After before retrying a rate-limited request', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '3' }))
      .mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = fetchRecentLeagueScores(['EPL'], 4)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_500)
    await pending

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('toEventTimestamp', () => {
  it('reads TheSportsDB timestamps as UTC', () => {
    expect(toEventTimestamp({ strTimestamp: '2026-10-10T02:00:00' })).toBe('2026-10-10T02:00:00Z')
    expect(toEventTimestamp({ strTimestamp: '2026-10-10T02:00:00+00:00' })).toBe('2026-10-10T02:00:00+00:00')
  })

  it('keeps a date-only event as a calendar date', () => {
    expect(toEventTimestamp({ dateEvent: '2026-10-10' })).toBe('2026-10-10')
  })
})

describe('parseEventStatus', () => {
  it.each([
    ['Match Finished', 'FT'],
    ['FT', 'FT'],
    ['AET', 'AET'],
    ['After Extra Time', 'AET'],
    ['After Pen.', 'PEN'],
    ['Penalties', 'PEN'],
    ['Suspended', 'SUSP'],
    ['Postponed', 'PST'],
    ['Abandoned', 'ABD'],
    ['2H', 'LIVE'],
    ['HT', 'LIVE'],
  ])('maps %s to %s', (raw, expected) => {
    expect(parseEventStatus(raw)).toBe(expected)
  })
})
