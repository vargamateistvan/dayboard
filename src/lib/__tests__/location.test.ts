import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPlaceNameCache, getCurrentLocation, parseCoordinates, reverseGeocode } from '../location'

describe('parseCoordinates', () => {
  it('parses valid coordinates', () => {
    expect(parseCoordinates('47.5', '19.04')).toEqual({ latitude: 47.5, longitude: 19.04 })
  })

  it.each([
    ['12abc', '19'],
    ['', '19'],
    ['91', '0'],
    ['0', '-181'],
  ])('rejects %s, %s', (lat, lon) => {
    expect(parseCoordinates(lat, lon)).toBeNull()
  })
})

describe('getCurrentLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for a position with a timeout', async () => {
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _error?: PositionErrorCallback, _options?: PositionOptions) =>
        success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(getCurrentLocation('weather')).resolves.toEqual({ latitude: 1, longitude: 2 })
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ timeout: expect.any(Number) })
  })

  it('explains a denied permission', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1 } as GeolocationPositionError),
      },
    })

    await expect(getCurrentLocation('weather')).rejects.toThrow('Location access denied. Enable location to see weather.')
  })
})

describe('reverseGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearPlaceNameCache()
  })

  it('caches by rounded coordinates', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ address: { city: 'Budapest' } }) }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await reverseGeocode({ latitude: 47.4979, longitude: 19.0402 })).toBe('Budapest')
    expect(await reverseGeocode({ latitude: 47.4981, longitude: 19.0399 })).toBe('Budapest')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null instead of throwing when the lookup fails, and retries later', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ address: { town: 'Szentendre' } }) })
    vi.stubGlobal('fetch', fetchMock)

    expect(await reverseGeocode({ latitude: 47.67, longitude: 19.07 })).toBeNull()
    expect(await reverseGeocode({ latitude: 47.67, longitude: 19.07 })).toBe('Szentendre')
  })
})
