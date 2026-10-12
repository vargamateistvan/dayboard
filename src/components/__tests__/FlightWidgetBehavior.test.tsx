import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FlightWidget } from '../FlightWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../lib/settings'
import { resetFlightRequestCache } from '../../lib/flights'

// Budapest. 0.09° of latitude is about 10 km, 0.36° about 40 km.
const HOME = { latitude: 47.4979, longitude: 19.0402 }

function plane(hex: string, flight: string, latOffset: number) {
  return { hex, flight, lat: HOME.latitude + latOffset, lon: HOME.longitude, alt_baro: 18_000, gs: 200, true_heading: 90, seen: 5 }
}

function respond(status: number, ac: unknown[] = []) {
  return { ok: status === 200, status, headers: { get: () => null }, json: async () => ({ ac }) }
}

function renderFlights(settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, flightsRadiusKm: 50, flightsRadarRadiusKm: 25, ...settingsPatch })
  return render(
    <SettingsProvider>
      <FlightWidget />
    </SettingsProvider>,
  )
}

async function waitForFlights() {
  await waitFor(() => expect(screen.queryByLabelText('Loading flights')).not.toBeInTheDocument())
}

async function refreshAfter(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh flights' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('FlightWidget behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success({ coords: HOME } as GeolocationPosition),
      },
    })
    localStorage.clear()
    resetFlightRequestCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('lists aircraft beyond the radar range without pinning them to its edge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, [plane('a1', 'NEAR1', 0.09), plane('b2', 'FAR22', 0.36)])))
    renderFlights()
    await waitForFlights()

    expect(screen.getByRole('button', { name: /Select NEAR1 on radar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Select FAR22 on radar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Select FAR22 from list/i })).toBeInTheDocument()
  })

  it('deselects an aircraft when it is clicked again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, [plane('a1', 'NEAR1', 0.09)])))
    renderFlights()
    await waitForFlights()

    const marker = screen.getByRole('button', { name: /Select NEAR1 on radar/i })
    fireEvent.click(marker)
    expect(marker).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(marker)
    expect(marker).toHaveAttribute('aria-pressed', 'false')
  })

  it('stops dimming the other aircraft once the selected one leaves', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respond(200, [plane('a1', 'NEAR1', 0.09), plane('c3', 'NEAR3', 0.05)]))
        .mockResolvedValue(respond(200, [plane('c3', 'NEAR3', 0.05)])),
    )
    renderFlights()
    await waitForFlights()
    fireEvent.click(screen.getByRole('button', { name: /Select NEAR1 on radar/i }))

    await refreshAfter(11_000)

    await waitFor(() => expect(screen.queryByRole('button', { name: /Select NEAR1 on radar/i })).not.toBeInTheDocument())
    expect(document.querySelector('[class*="planeMarkerDimmed"]')).toBeNull()
  })

  it('says when it is showing old flights because a refresh failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(respond(200, [plane('a1', 'NEAR1', 0.09)])).mockResolvedValue(respond(429)),
    )
    renderFlights()
    await waitForFlights()

    await refreshAfter(11_000)

    await waitFor(() => expect(screen.getByText(/couldn.t refresh/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Select NEAR1 on radar/i })).toBeInTheDocument()
  })

  it('defaults to a refresh interval the free APIs can sustain', () => {
    expect(DEFAULT_SETTINGS.flightsRefreshSeconds).toBeGreaterThanOrEqual(10)

    saveSettings({ ...DEFAULT_SETTINGS, flightsRefreshSeconds: 2 })
    expect(loadSettings().flightsRefreshSeconds).toBeGreaterThanOrEqual(10)
  })
})
