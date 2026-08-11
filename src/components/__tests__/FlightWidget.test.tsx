import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FlightWidget } from '../FlightWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { resetFlightRequestCache } from '../../lib/flights'

const mockGeolocation = {
  getCurrentPosition: vi.fn(),
}

function renderWithSettings(settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(
    <SettingsProvider>
      <FlightWidget />
    </SettingsProvider>,
  )
}

describe('FlightWidget', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { geolocation: mockGeolocation })
    localStorage.clear()
    resetFlightRequestCache()
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nearby flights from device location', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.4979, longitude: 19.0402 } } as GeolocationPosition)
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        time: 1_786_362_327,
        states: [
          [
            '49d099',
            'WZZ123  ',
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
          [
            '4a068b',
            'ROT226J ',
            'Romania',
            1_786_362_326,
            1_786_362_322,
            19.1875,
            47.5327,
            5_791.2,
            false,
            138.03,
            128.49,
            0,
            null,
            6_126.48,
            '1000',
            false,
            0,
          ],
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    renderWithSettings({ flightsRadiusKm: 50 })

    await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.airplanes.live/v2/point/')
    expect(screen.getByText(/2 aircraft/)).toBeInTheDocument()
    expect(screen.getAllByText(/WZZ123/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Device location/)).toBeInTheDocument()
    expect(screen.getByText(/outer ring 25 km/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Nearby flights' })).toBeInTheDocument()
  })

  it('falls back to manual coordinates when geolocation is denied', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(
      (_success: unknown, error: PositionErrorCallback) => {
        error({ code: 1, message: 'denied' } as GeolocationPositionError)
      },
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
        }),
      }),
    )

    renderWithSettings({
      flightsManualLatitude: '47.4979',
      flightsManualLongitude: '19.0402',
    })

    await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())

    expect(screen.getByText(/Manual coordinates/)).toBeInTheDocument()
    expect(screen.getAllByText(/WZZ123/).length).toBeGreaterThan(0)
  })

  it('shows an empty state when no nearby flights are returned', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.4979, longitude: 19.0402 } } as GeolocationPosition)
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          time: 1_786_362_327,
          states: [],
        }),
      }),
    )

    renderWithSettings()

    await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())

    expect(screen.getByText(/No airborne aircraft found within 50 km right now/)).toBeInTheDocument()
  })

  it('requires valid manual coordinates when device location is disabled', async () => {
    renderWithSettings({
      flightsUseDeviceLocation: false,
      flightsManualLatitude: '',
      flightsManualLongitude: '',
    })

    await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())

    expect(screen.getByText(/Add valid manual coordinates/)).toBeInTheDocument()
  })

  it('shows selected aircraft details when selecting a plane on radar', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.4979, longitude: 19.0402 } } as GeolocationPosition)
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
        }),
      }),
    )

    renderWithSettings({ flightsRadiusKm: 50 })
    await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Select WZZ123 on radar/i }))

    expect(screen.getByText(/Selected aircraft/i)).toBeInTheDocument()
    expect(screen.getByText(/ICAO24: 49D099/i)).toBeInTheDocument()
    expect(screen.getByText(/Registration: HA-LVE/i)).toBeInTheDocument()
    expect(screen.getByText(/Type: A21N/i)).toBeInTheDocument()
    expect(screen.getByText(/Model: AIRBUS A321neo/i)).toBeInTheDocument()
  })
})
