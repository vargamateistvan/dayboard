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

  it('covers the whole radius east-west at high latitudes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { states: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchNearbyFlights({ latitude: 60, longitude: 10, radiusKm: 250, onlyAirborne: false })

    const requested = decodeURIComponent(String(fetchMock.mock.calls[0][0]))
    const lomin = Number(/lomin=([-\d.]+)/.exec(requested)?.[1])
    const lomax = Number(/lomax=([-\d.]+)/.exec(requested)?.[1])
    // 250 km at 60°N is about 4.5° of longitude each way.
    expect(lomax - lomin).toBeGreaterThan(8.5)
  })
})
