import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { AstronomyWidget } from '../AstronomyWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { clearPlaceNameCache } from '../../lib/location'

interface Place {
  latitude: string
  longitude: string
  timezone: string
  offsetSeconds: number
  day: string
  sunrise: string
  sunset: string
}

const LONDON_WINTER: Place = {
  latitude: '51.5074',
  longitude: '-0.1278',
  timezone: 'Europe/London',
  offsetSeconds: 0,
  day: '2026-12-21',
  sunrise: '2026-12-21T08:04',
  sunset: '2026-12-21T15:53',
}

function astronomyResponse(place: Place) {
  return {
    timezone: place.timezone,
    utc_offset_seconds: place.offsetSeconds,
    daily: {
      time: [place.day],
      sunrise: [place.sunrise],
      sunset: [place.sunset],
      moonrise: [`${place.day}T10:00`],
      moonset: [`${place.day}T20:00`],
      moon_phase: [0.5],
    },
  }
}

function stubFetch(place: Place, geocode: () => unknown = () => ({ ok: true, json: async () => ({ address: { city: 'Somewhere' } }) })) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes('nominatim') ? geocode() : { ok: true, json: async () => astronomyResponse(place) },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAt(place: Place, settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({
    ...DEFAULT_SETTINGS,
    astronomyUseDeviceLocation: false,
    astronomyManualLatitude: place.latitude,
    astronomyManualLongitude: place.longitude,
    ...settingsPatch,
  })
  return render(
    <SettingsProvider>
      <AstronomyWidget />
    </SettingsProvider>,
  )
}

async function waitForData() {
  await waitFor(() => expect(screen.queryByLabelText('Loading astronomy')).not.toBeInTheDocument())
}

function sunValue(label: string): string {
  return screen.getAllByText(label)[0].nextElementSibling?.textContent ?? ''
}

describe('AstronomyWidget accuracy', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    clearPlaceNameCache()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows the real sun altitude, not a made-up 90° peak', async () => {
    vi.setSystemTime(new Date('2026-12-21T12:00:00Z'))
    stubFetch(LONDON_WINTER)
    renderAt(LONDON_WINTER)
    await waitForData()

    const altitude = Number.parseInt(sunValue('Altitude:'), 10)
    expect(altitude).toBeGreaterThanOrEqual(13)
    expect(altitude).toBeLessThanOrEqual(17)
  })

  it('shows the noon sun due north in the southern hemisphere', async () => {
    const sydney: Place = {
      latitude: '-33.8688',
      longitude: '151.2093',
      timezone: 'Australia/Sydney',
      offsetSeconds: 36_000,
      day: '2026-06-21',
      sunrise: '2026-06-21T07:00',
      sunset: '2026-06-21T16:54',
    }
    vi.setSystemTime(new Date('2026-06-21T02:00:00Z'))
    stubFetch(sydney)
    renderAt(sydney)
    await waitForData()

    expect(sunValue('Direction:')).toMatch(/\b(N|NNE|NNW)\b/)
  })

  it('shows night all day during polar night', async () => {
    const svalbard: Place = {
      latitude: '78.22',
      longitude: '15.65',
      timezone: 'Arctic/Longyearbyen',
      offsetSeconds: 3_600,
      day: '2026-12-21',
      sunrise: '2026-12-21T00:00',
      sunset: '2026-12-21T00:00',
    }
    vi.setSystemTime(new Date('2026-12-21T11:00:00Z'))
    stubFetch(svalbard)
    renderAt(svalbard)
    await waitForData()

    expect(sunValue('Phase:')).toBe('Night')
    expect(Number.parseInt(sunValue('Altitude:'), 10)).toBeLessThan(0)
  })

  it('still shows the sky when the place name lookup fails', async () => {
    vi.setSystemTime(new Date('2026-12-21T12:00:00Z'))
    stubFetch(LONDON_WINTER, () => ({
      ok: false,
      status: 429,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }))
    renderAt(LONDON_WINTER)
    await waitForData()

    expect(screen.queryByText(/Could not load astronomy data/)).not.toBeInTheDocument()
    expect(screen.getByText('Unknown location')).toBeInTheDocument()
  })

  it('rejects manual coordinates with trailing junk', async () => {
    stubFetch(LONDON_WINTER)
    renderAt({ ...LONDON_WINTER, latitude: '51abc' })
    await waitForData()

    expect(screen.getByText(/Enter valid manual coordinates/)).toBeInTheDocument()
  })

  it('reloads after local midnight even with a long refresh interval', async () => {
    vi.setSystemTime(new Date('2026-12-21T23:58:00Z'))
    const fetchMock = stubFetch(LONDON_WINTER)
    renderAt(LONDON_WINTER, { astronomyRefreshMinutes: 720 })
    await waitForData()
    const astronomyCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('open-meteo')).length
    expect(astronomyCalls()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000)
    })

    expect(astronomyCalls()).toBe(2)
  })

  it('uses one name for the last quarter phase', async () => {
    vi.setSystemTime(new Date('2026-12-21T12:00:00Z'))
    stubFetch(LONDON_WINTER)
    renderAt(LONDON_WINTER)
    await waitForData()

    expect(screen.queryByText('Third Quarter')).not.toBeInTheDocument()
    expect(screen.getByText('Last Quarter')).toBeInTheDocument()
  })
})
