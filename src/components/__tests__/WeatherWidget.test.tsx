import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WeatherWidget } from '../WeatherWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'

const mockGeolocation = {
  getCurrentPosition: vi.fn(),
}

beforeEach(() => {
  vi.stubGlobal('navigator', { geolocation: mockGeolocation })
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderWithSettings(settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(
    <SettingsProvider>
      <WeatherWidget />
    </SettingsProvider>,
  )
}

describe('WeatherWidget', () => {
  it('shows loading state while fetching', () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // never resolves
    })
    renderWithSettings()
    expect(screen.getByLabelText('Loading weather')).toBeInTheDocument()
  })

  it('renders temperature and condition after successful fetch', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.5, longitude: 19.0 } } as GeolocationPosition)
    })

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 22,
              apparent_temperature: 24,
              relative_humidity_2m: 56,
              wind_speed_10m: 18,
              wind_direction_10m: 90,
              weather_code: 1,
            },
            timezone: 'Europe/Budapest',
            utc_offset_seconds: 7200,
            daily: {
              temperature_2m_max: [27],
              temperature_2m_min: [18],
              precipitation_probability_max: [35],
              sunrise: ['2026-08-07T05:45'],
              sunset: ['2026-08-07T20:16'],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { city: 'Budapest' },
          }),
        }),
    )

    renderWithSettings()
    await waitFor(() => expect(screen.queryByLabelText('Loading weather')).not.toBeInTheDocument())

    expect(screen.getByText(/22°C/)).toBeInTheDocument()
    expect(screen.getByText(/Budapest/)).toBeInTheDocument()
    expect(screen.getByText(/Today forecast:/)).toBeInTheDocument()
    expect(screen.getByText(/H 27°C · L 18°C · Rain 35%/)).toBeInTheDocument()
    expect(screen.getByText(/Feels like/)).toBeInTheDocument()
    expect(screen.getByText(/24°C/)).toBeInTheDocument()
    expect(screen.getByText(/Humidity/)).toBeInTheDocument()
    expect(screen.getByText(/56%/)).toBeInTheDocument()
    expect(screen.getByText(/Wind/)).toBeInTheDocument()
    expect(screen.getByText(/18 km\/h · E \(90°\)/)).toBeInTheDocument()
    expect(screen.getByText(/Sunrise/)).toBeInTheDocument()
    expect(screen.getByText(/05:45/)).toBeInTheDocument()
    expect(screen.getByText(/Sunset/)).toBeInTheDocument()
    expect(screen.getByText(/20:16/)).toBeInTheDocument()
    expect(screen.getByText(/Updated just now/)).toBeInTheDocument()
  })

  it('shows error message when geolocation is denied', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(
      (_success: unknown, error: PositionErrorCallback) => {
        error({ code: 1, message: 'denied' } as GeolocationPositionError)
      },
    )
    renderWithSettings()
    await waitFor(() => expect(screen.queryByLabelText('Loading weather')).not.toBeInTheDocument())
    expect(screen.getByText(/Location access denied/)).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.5, longitude: 19.0 } } as GeolocationPosition)
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    renderWithSettings()
    await waitFor(() => expect(screen.queryByLabelText('Loading weather')).not.toBeInTheDocument())
    expect(screen.getByText(/Could not load weather data/)).toBeInTheDocument()
  })

  it('uses the configured refresh interval', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // no-op
    })

    renderWithSettings({ weatherRefreshMinutes: 3 })

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3 * 60 * 1000)
  })
})
