import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNearbyFlights, resetFlightRequestCache } from '../flights'

function buildOpenSkyPayload() {
  return {
    time: 1_786_362_327,
    states: [
      [
        '49d099',
        'WZZ123',
        'Hungary',
        1_786_362_326,
        1_786_362_320,
        19.0623,
        47.5375,
        5_478.78,
        false,
        106.19,
        49.52,
        -0.65,
        null,
        5_844.54,
        '1000',
        false,
        0,
      ],
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
        payload: buildOpenSkyPayload(),
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
          payload: buildOpenSkyPayload(),
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
})
