import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { WeatherWidget } from '../WeatherWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { clearPlaceNameCache } from '../../lib/location'

const DAYS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']

function weatherResponse(overrides: { daily?: Record<string, unknown>; current?: Record<string, unknown> } = {}) {
  return {
    current: {
      temperature_2m: 12,
      apparent_temperature: 10,
      relative_humidity_2m: 70,
      cloud_cover: 50,
      uv_index: 2,
      wind_speed_10m: 9,
      wind_direction_10m: 200,
      weather_code: 3,
      ...overrides.current,
    },
    timezone: 'Europe/Budapest',
    utc_offset_seconds: 7200,
    daily: {
      time: DAYS,
      temperature_2m_max: DAYS.map(() => 15),
      temperature_2m_min: DAYS.map(() => 5),
      precipitation_probability_max: DAYS.map(() => 20),
      precipitation_sum: DAYS.map(() => 0),
      wind_speed_10m_max: DAYS.map(() => 14),
      weather_code: DAYS.map(() => 3),
      sunrise: DAYS.map((day) => `${day}T07:00`),
      sunset: DAYS.map((day) => `${day}T18:15`),
      ...overrides.daily,
    },
  }
}

type Responder = (url: string) => { ok: boolean; status?: number; json: () => Promise<unknown> } | Promise<never>

function stubFetch(responder: Responder) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => responder(String(input)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body }
}

function defaultResponder(weather = weatherResponse()): Responder {
  return (url) => (url.includes('nominatim') ? okJson({ address: { city: 'Budapest' } }) : okJson(weather))
}

function renderWeather(settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}, isFullscreen = false) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(
    <SettingsProvider>
      <WeatherWidget isFullscreen={isFullscreen} />
    </SettingsProvider>,
  )
}

async function waitForWeather() {
  await waitFor(() => expect(screen.queryByLabelText('Loading weather')).not.toBeInTheDocument())
}

describe('WeatherWidget data handling', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 47.5, longitude: 19.04 } } as GeolocationPosition),
      },
    })
    clearPlaceNameCache()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('shows seven days in the 7-day forecast', async () => {
    const fetchMock = stubFetch(defaultResponder())
    renderWeather({}, true)
    await waitForWeather()

    const forecastUrl = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('open-meteo'))
    expect(forecastUrl).toContain('forecast_days=8')
    expect(document.querySelectorAll('[class*="forecastDay"]')).toHaveLength(7)
  })

  it('shows the full wind unit in the forecast', async () => {
    stubFetch(defaultResponder())
    renderWeather({}, true)
    await waitForWeather()

    expect(screen.getAllByText('Wind: 14 km/h').length).toBe(7)
  })

  it.each([
    [66, 'Freezing rain'],
    [56, 'Freezing drizzle'],
    [85, 'Snow showers'],
    [96, 'Thunderstorm + hail'],
    [77, 'Snow grains'],
  ])('labels weather code %i as %s', async (code, label) => {
    stubFetch(defaultResponder(weatherResponse({ current: { weather_code: code } })))
    renderWeather()
    await waitForWeather()

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows missing forecast values as a dash, not 0', async () => {
    stubFetch(
      defaultResponder(
        weatherResponse({
          daily: { temperature_2m_max: DAYS.map(() => null), precipitation_probability_max: DAYS.map(() => null) },
        }),
      ),
    )
    renderWeather({}, true)
    await waitForWeather()

    const firstDay = document.querySelector('[class*="forecastDay"]') as HTMLElement
    expect(within(firstDay).queryByText('0°')).not.toBeInTheDocument()
    expect(within(firstDay).getByText('Rain: —')).toBeInTheDocument()
  })

  it('shows no sunrise or sunset time during polar night', async () => {
    stubFetch(
      defaultResponder(
        weatherResponse({
          daily: { sunrise: DAYS.map((day) => `${day}T00:00`), sunset: DAYS.map((day) => `${day}T00:00`) },
        }),
      ),
    )
    renderWeather({ weatherShowExtraDetails: true })
    await waitForWeather()

    expect(screen.queryByText('02:00')).not.toBeInTheDocument()
    expect(screen.queryByText('00:00')).not.toBeInTheDocument()
  })

  it('still shows the weather when the place name lookup fails', async () => {
    // Nominatim answers rate-limited requests with an HTML page.
    const htmlError = {
      ok: false,
      status: 429,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }
    stubFetch((url) => (url.includes('nominatim') ? htmlError : okJson(weatherResponse())))
    renderWeather()
    await waitForWeather()

    expect(screen.getByText(/12°C/)).toBeInTheDocument()
    expect(screen.getByText('Unknown location')).toBeInTheDocument()
  })

  it('keeps the weather on screen when a refresh fails', async () => {
    let weatherCalls = 0
    stubFetch((url) => {
      if (url.includes('nominatim')) return okJson({ address: { city: 'Budapest' } })
      weatherCalls += 1
      return weatherCalls === 1 ? okJson(weatherResponse()) : { ok: false, status: 503, json: async () => ({}) }
    })
    renderWeather()
    await waitForWeather()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh weather' }))

    await waitFor(() => expect(screen.getByText(/couldn.t refresh/i)).toBeInTheDocument())
    expect(screen.getByText(/12°C/)).toBeInTheDocument()
  })

  it('caps a huge refresh interval instead of polling nonstop', async () => {
    stubFetch(defaultResponder())
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    renderWeather({ weatherRefreshMinutes: 40_000 })
    await act(async () => {})

    const intervals = setIntervalSpy.mock.calls.map(([, ms]) => ms as number)
    expect(intervals.every((ms) => ms < 2 ** 31 - 1)).toBe(true)
    expect(intervals).toContain(24 * 60 * 60_000)
  })
})
