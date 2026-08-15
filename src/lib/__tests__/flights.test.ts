import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNearbyFlights, resetFlightRequestCache } from '../flights'

function buildAirplanesLivePayload() {
  return {
    ac: [
      {
        hex: '49d099',
        flight: 'WZZ123',
        r: 'HA-LVE',
        t: 'A21N',
        desc: 'AIRBUS A321neo',
        lat: 47.5375,
        lon: 19.0623,
        alt_baro: 17_975,
        alt_geom: 19_175,
        gs: 206.3,
        true_heading: 49.52,
        geom_rate: -128,
        seen: 7,
      },
    ],
  }
}

function createResponse({
  ok,
  status,
  payload,
  retryAfter,
}: {
  ok: boolean
  status: number
  payload?: unknown
  retryAfter?: string
}): Response {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null),
    },
    json: async () => payload,
  } as Response
}

describe('fetchNearbyFlights', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T10:00:00.000Z'))
    resetFlightRequestCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reuses cached data inside the minimum fetch interval', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        payload: buildAirplanesLivePayload(),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = {
      latitude: 47.4979,
      longitude: 19.0402,
      radiusKm: 50,
      onlyAirborne: true,
    }

    const firstLoad = await fetchNearbyFlights(request)
    vi.advanceTimersByTime(2_000)
    const secondLoad = await fetchNearbyFlights(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondLoad).toEqual(firstLoad)
  })

  it('serves stale cache while the endpoint is rate-limited', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          status: 200,
          payload: buildAirplanesLivePayload(),
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 429,
          retryAfter: '120',
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const request = {
      latitude: 47.4979,
      longitude: 19.0402,
      radiusKm: 50,
      onlyAirborne: true,
    }

    const firstLoad = await fetchNearbyFlights(request)

    vi.advanceTimersByTime(11_000)
    const rateLimitedLoad = await fetchNearbyFlights(request)
    vi.advanceTimersByTime(2_000)
    const blockedLoad = await fetchNearbyFlights(request)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(rateLimitedLoad).toEqual(firstLoad)
    expect(blockedLoad).toEqual(firstLoad)
  })

  it('supports airplanes.live payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse({
          ok: true,
          status: 200,
          payload: buildAirplanesLivePayload(),
        }),
      ),
    )

    const flights = await fetchNearbyFlights({
      latitude: 47.4979,
      longitude: 19.0402,
      radiusKm: 50,
      onlyAirborne: true,
    })

    expect(flights).toHaveLength(1)
    expect(flights[0]).toEqual(
      expect.objectContaining({
        icao24: '49d099',
        callsign: 'WZZ123',
        registration: 'HA-LVE',
        aircraftTypeCode: 'A21N',
        aircraftDescription: 'AIRBUS A321neo',
        groundspeedKmh: expect.any(Number),
        headingDegrees: 50,
        lastSeenSecondsAgo: 7,
      }),
    )
  })

  it('surfaces proxy rate-limit responses as a friendly flight-data error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        clone: () => ({ text: async () => 'Too many requests' }),
        json: async () => {
          throw new Error('should not parse JSON')
        },
      }),
    )

    await expect(
      fetchNearbyFlights({
        latitude: 47.4979,
        longitude: 19.0402,
        radiusKm: 50,
        onlyAirborne: true,
      }),
    ).rejects.toThrow(/temporarily unavailable/i)
  })
})
