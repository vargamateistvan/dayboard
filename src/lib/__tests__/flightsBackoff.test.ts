import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNearbyFlights, fetchNearbyFlightSnapshot, resetFlightRequestCache } from '../flights'

const REQUEST = { latitude: 47.4979, longitude: 19.0402, radiusKm: 50, onlyAirborne: true }

function jsonResponse(status: number, payload: unknown = {}, retryAfter: string | null = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter : null) },
    json: async () => payload,
  } as Response
}

function textResponse(status: number, text: string, contentType = 'text/html'): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
    clone: () => response,
  }
  return response as unknown as Response
}

const ONE_PLANE = {
  ac: [{ hex: '49d099', flight: 'WZZ123', lat: 47.5375, lon: 19.0623, alt_baro: 17_975, gs: 206, seen: 7 }],
}

describe('flight request backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
    resetFlightRequestCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('honours a rate limit even when nothing is cached yet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(429, {}, '60'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow(/rate-limited/i)
    vi.advanceTimersByTime(2_000)
    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow(/rate-limited/i)
    vi.advanceTimersByTime(30_000)
    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow(/rate-limited/i)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('waits before retrying after a failed request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(502))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow()
    vi.advanceTimersByTime(2_000)
    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks cached flights served during a rate limit as stale, with their real age', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, ONE_PLANE))
      .mockResolvedValueOnce(jsonResponse(429, {}, '120'))
    vi.stubGlobal('fetch', fetchMock)

    const fresh = await fetchNearbyFlightSnapshot(REQUEST)
    expect(fresh.stale).toBe(false)

    vi.advanceTimersByTime(11_000)
    const stale = await fetchNearbyFlightSnapshot(REQUEST)

    expect(stale.stale).toBe(true)
    expect(stale.fetchedAtMs).toBe(fresh.fetchedAtMs)
    expect(stale.flights).toEqual(fresh.flights)
  })

  it('treats an unrecognised HTML error page as an error, not as "no aircraft"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse(200, '<html><body>Oops, upstream error</body></html>')))

    await expect(fetchNearbyFlights(REQUEST)).rejects.toThrow(/malformed|unavailable/i)
  })

  it('requests an adsb.lol point query with the radius in nautical miles', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ac: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchNearbyFlights({ latitude: 60, longitude: 10, radiusKm: 50, onlyAirborne: false })

    // 50 km is 27 nautical miles, rounded up so the whole radius is covered.
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v2/point/60.0000/10.0000/27')
  })
})
