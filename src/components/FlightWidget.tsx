import { useCallback, useEffect, useMemo, useState } from 'react'
import { LocateFixed, MapPin, Plane, RefreshCw } from 'lucide-react'
import { useSettings } from '../lib/useSettings'
import { fetchNearbyFlights, type NearbyFlight } from '../lib/flights'
import styles from './FlightWidget.module.css'

interface FlightWidgetProps {
  readonly isFullscreen?: boolean
}

interface Coordinates {
  latitude: number
  longitude: number
}

function parseCoordinate(value: string, kind: 'latitude' | 'longitude'): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }

  if (kind === 'latitude') {
    return parsed >= -90 && parsed <= 90 ? parsed : null
  }

  return parsed >= -180 && parsed <= 180 ? parsed : null
}

function getManualCoordinates(latitude: string, longitude: string): Coordinates | null {
  const parsedLatitude = parseCoordinate(latitude, 'latitude')
  const parsedLongitude = parseCoordinate(longitude, 'longitude')

  if (parsedLatitude === null || parsedLongitude === null) {
    return null
  }

  return { latitude: parsedLatitude, longitude: parsedLongitude }
}

function formatLastRefresh(lastRefreshedAt: number, now: number): string {
  const diffMs = Math.max(0, now - lastRefreshedAt)
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes <= 0) {
    return 'Updated just now'
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  return `Updated ${diffHours} hr${diffHours === 1 ? '' : 's'} ago`
}

function formatAltitude(altitudeMeters: number | null): string {
  if (altitudeMeters === null) {
    return 'Altitude unavailable'
  }

  const altitudeFeet = altitudeMeters * 3.28084
  if (altitudeFeet >= 18_000) {
    return `FL${Math.round(altitudeFeet / 100)}`
  }

  return `${Math.round(altitudeFeet).toLocaleString()} ft`
}

function formatGroundSpeed(groundspeedKmh: number | null): string {
  return groundspeedKmh === null ? 'Speed unavailable' : `${groundspeedKmh} km/h`
}

function formatHeading(headingDegrees: number | null): string {
  return headingDegrees === null ? 'Heading unavailable' : `${headingDegrees}°`
}

function formatVerticalRate(verticalRateMetersPerMinute: number | null): string {
  if (verticalRateMetersPerMinute === null) {
    return 'Vertical rate unavailable'
  }

  if (verticalRateMetersPerMinute === 0) {
    return 'Level flight'
  }

  const direction = verticalRateMetersPerMinute > 0 ? 'Climbing' : 'Descending'
  return `${direction} ${Math.abs(verticalRateMetersPerMinute)} m/min`
}

function getFlightName(flight: NearbyFlight): string {
  return flight.callsign ?? flight.icao24.toUpperCase()
}

const AIRBUS_A320_SILHOUETTE_PATH =
  'M 251.239 4.012 C 242.63 11.82 234.623 25.533 230.719 39.347 C 229.117 45.252 228.817 51.959 228.316 111.718 L 227.816 177.582 L 211.3 186.391 L 194.784 195.299 L 194.183 180.085 C 193.783 169.674 193.082 163.769 191.981 161.166 L 190.379 157.362 L 176.566 157.663 L 162.752 157.963 L 161.251 160.966 C 160.25 163.168 159.749 168.773 159.449 181.686 C 158.948 202.006 159.249 204.208 162.752 205.109 C 164.654 205.609 165.255 206.41 165.255 208.412 C 165.255 211.015 161.451 213.117 97.989 247.15 C 60.953 266.869 29.622 284.186 28.421 285.488 C 25.218 288.891 23.416 296.098 22.315 309.611 C 21.814 315.918 21.514 321.323 21.714 321.423 C 21.814 321.623 23.216 319.221 24.817 316.018 L 27.62 310.212 L 99.09 285.388 L 170.46 260.563 L 199.388 260.563 L 228.316 260.563 L 228.316 315.817 C 228.316 382.282 229.618 399.7 236.725 427.427 L 239.027 436.536 L 233.922 441.541 C 228.116 447.246 213.602 457.856 190.279 473.272 C 181.471 479.077 173.463 484.983 172.562 486.485 C 171.361 488.186 170.76 491.79 170.46 497.896 C 170.059 505.703 170.26 506.804 171.661 506.804 C 172.562 506.804 189.478 502.7 209.298 497.796 C 229.117 492.791 245.633 488.787 246.134 488.787 C 246.634 488.787 247.435 492.29 248.036 496.695 C 248.636 500.999 249.938 506.304 250.939 508.406 C 252.64 511.809 253.241 512.31 256.344 512.31 C 259.447 512.31 260.047 511.809 261.749 508.406 C 262.75 506.304 264.051 500.999 264.652 496.695 C 265.253 492.29 266.053 488.787 266.554 488.787 C 267.054 488.787 283.571 492.891 303.39 497.796 C 323.209 502.801 340.126 506.804 341.027 506.804 C 342.428 506.804 342.628 505.703 342.228 497.896 C 341.928 491.79 341.327 488.186 340.126 486.384 C 339.125 484.983 331.317 479.077 322.609 473.372 C 299.987 458.457 284.672 447.346 278.766 441.541 L 273.661 436.536 L 275.963 427.427 C 283.07 399.7 284.371 382.282 284.371 315.817 L 284.371 260.563 L 313.3 260.563 L 342.228 260.563 L 413.598 285.388 L 485.068 310.212 L 487.871 316.018 C 489.472 319.221 490.873 321.623 490.974 321.423 C 491.174 321.323 490.873 315.918 490.373 309.611 C 489.272 296.098 487.47 288.891 484.267 285.488 C 483.066 284.186 451.735 266.869 414.699 247.15 C 351.237 213.117 347.433 211.015 347.433 208.412 C 347.433 206.41 348.034 205.609 349.935 205.109 C 353.439 204.208 353.739 202.006 353.239 181.686 C 352.938 168.773 352.438 163.168 351.437 160.966 L 349.935 157.963 L 336.122 157.663 L 322.308 157.362 L 320.707 161.166 C 319.606 163.769 318.905 169.674 318.505 180.085 L 317.904 195.299 L 301.188 186.291 L 284.371 177.282 L 284.371 115.121 C 284.271 48.356 284.071 44.652 279.066 31.139 C 277.765 27.435 275.062 21.83 273.26 18.727 C 269.757 12.921 258.246 0.308 256.344 0.308 C 255.843 0.308 253.541 2.01 251.239 4.012 Z'

function RadarPlaneIcon({ rotationDegrees }: { rotationDegrees: number }) {
  return (
    <g transform={`rotate(${rotationDegrees.toFixed(0)})`}>
      <path
        className={styles.planeMarkerFill}
        d={AIRBUS_A320_SILHOUETTE_PATH}
        transform="translate(-6.4 -6.4) scale(0.025)"
      />
      <path
        className={styles.planeMarkerOutline}
        d={AIRBUS_A320_SILHOUETTE_PATH}
        transform="translate(-6.4 -6.4) scale(0.025)"
      />
    </g>
  )
}

function RadarPlot({
  flights,
  maxRadiusKm,
  showLabels,
  isFullscreen,
  selectedFlightIcao,
  onSelectFlight,
}: {
  flights: NearbyFlight[]
  maxRadiusKm: number
  showLabels: boolean
  isFullscreen: boolean
  selectedFlightIcao: string | null
  onSelectFlight: (flight: NearbyFlight) => void
}) {
  const labelLimit = isFullscreen ? 8 : 3
  const rangeStepKm = Math.max(1, Math.round(maxRadiusKm / 3))
  const radarLabels = [
    { x: 50, y: 9, label: 'N' },
    { x: 91, y: 51.5, label: 'E' },
    { x: 50, y: 94, label: 'S' },
    { x: 9, y: 51.5, label: 'W' },
  ]

  return (
    <div className={styles.radarScope}>
      <div className={styles.radarSweep} aria-hidden="true" />
      <div className={styles.radarSweepBeam} aria-hidden="true" />
      <div className={styles.radarGlass} aria-hidden="true" />
      <svg className={styles.radar} viewBox="0 0 100 100" role="img" aria-label="Nearby flights radar">
        <circle className={styles.radarBackground} cx="50" cy="50" r="46" />
        <circle className={styles.radarOuterGlow} cx="50" cy="50" r="44.5" />
        <circle className={styles.radarOuter} cx="50" cy="50" r="44" />
        <circle className={styles.radarRing} cx="50" cy="50" r="29.5" />
        <circle className={styles.radarRing} cx="50" cy="50" r="14.5" />
        <line className={styles.radarAxis} x1="50" y1="6" x2="50" y2="94" />
        <line className={styles.radarAxis} x1="6" y1="50" x2="94" y2="50" />
        <circle className={styles.radarCenterGlow} cx="50" cy="50" r="4.5" />
        <circle className={styles.radarCenter} cx="50" cy="50" r="2.5" />

        {radarLabels.map((entry) => (
          <text key={entry.label} className={styles.radarLabel} x={entry.x} y={entry.y}>
            {entry.label}
          </text>
        ))}

        <text className={styles.radarRangeLabel} x="52" y="35.5">
          {rangeStepKm} km
        </text>
        <text className={styles.radarRangeLabel} x="52" y="20.5">
          {rangeStepKm * 2} km
        </text>
        <text className={styles.radarRangeLabel} x="52" y="6.5">
          {maxRadiusKm} km
        </text>

        {flights.map((flight, index) => {
          const ratio = Math.min(1, flight.distanceKm / maxRadiusKm)
          const angle = (flight.bearingDegrees * Math.PI) / 180
          const x = 50 + Math.sin(angle) * ratio * 42
          const y = 50 - Math.cos(angle) * ratio * 42
          const planeRotation = flight.headingDegrees ?? flight.bearingDegrees
          const isSelected = selectedFlightIcao === flight.icao24

          return (
            <g
              key={flight.icao24}
              transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
              className={[
                styles.planeMarker,
                isSelected ? styles.planeMarkerSelected : '',
              ].join(' ')}
              role="button"
              tabIndex={0}
              aria-label={`Select ${getFlightName(flight)} on radar`}
              onClick={() => onSelectFlight(flight)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectFlight(flight)
                }
              }}
            >
              <circle className={styles.planeHitArea} cx="0" cy="0" r="3.8" />
              {isSelected ? <circle className={styles.planeSelectionRing} cx="0" cy="0" r="3.3" /> : null}
              <RadarPlaneIcon rotationDegrees={planeRotation} />
              {showLabels && index < labelLimit ? (
                <text className={styles.planeLabel} x="3.8" y="-3.1">
                  {getFlightName(flight)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function FlightWidget({ isFullscreen = false }: FlightWidgetProps) {
  const { settings } = useSettings()
  const [flights, setFlights] = useState<NearbyFlight[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [locationSource, setLocationSource] = useState('Device location')
  const [hasInitialized, setHasInitialized] = useState(false)
  const [selectedFlightIcao, setSelectedFlightIcao] = useState<string | null>(null)

  const load = useCallback(() => {
    const manualCoordinates = getManualCoordinates(
      settings.flightsManualLatitude,
      settings.flightsManualLongitude,
    )

    const requestFlights = async (
      coordinates: Coordinates,
      sourceLabel: string,
    ) => {
      try {
        const nearbyFlights = await fetchNearbyFlights({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          radiusKm: settings.flightsRadiusKm,
          onlyAirborne: settings.flightsShowOnlyAirborne,
        })

        setFlights(nearbyFlights)
        setLocationSource(sourceLabel)
        setLastRefreshedAt(Date.now())
        setNow(Date.now())
        setError(null)
        setHasInitialized(true)
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load nearby flights.',
        )
        setHasInitialized(true)
      } finally {
        setLoading(false)
      }
    }

    // Only show loading state on initial load, not on refresh
    if (!hasInitialized) {
      setLoading(true)
    }
    setError(null)

    if (!settings.flightsUseDeviceLocation) {
      if (!manualCoordinates) {
        setFlights([])
        setLoading(false)
        setError('Add valid manual coordinates in settings to load nearby flights.')
        setHasInitialized(true)
        return
      }

      void requestFlights(manualCoordinates, 'Manual coordinates')
      return
    }

    if (!navigator.geolocation) {
      if (manualCoordinates) {
        void requestFlights(manualCoordinates, 'Manual coordinates')
        return
      }

      setFlights([])
      setLoading(false)
      setError('Geolocation is unavailable. Add manual coordinates in settings to use the flights widget.')
      setHasInitialized(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void requestFlights(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          'Device location',
        )
      },
      () => {
        if (manualCoordinates) {
          void requestFlights(manualCoordinates, 'Manual coordinates')
          return
        }

        setFlights([])
        setLoading(false)
        setError('Location access denied. Add manual coordinates or allow location access to see nearby flights.')
        setHasInitialized(true)
      },
      {
        enableHighAccuracy: false,
        maximumAge: settings.flightsRefreshSeconds * 1000,
        timeout: 10_000,
      },
    )
  }, [
    settings.flightsManualLatitude,
    settings.flightsManualLongitude,
    settings.flightsRadiusKm,
    settings.flightsRefreshSeconds,
    settings.flightsShowOnlyAirborne,
    settings.flightsUseDeviceLocation,
    hasInitialized,
  ])

  useEffect(() => {
    load()
    const intervalId = window.setInterval(load, settings.flightsRefreshSeconds * 1000)
    return () => window.clearInterval(intervalId)
  }, [load, settings.flightsRefreshSeconds])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const nearestFlight = flights[0] ?? null
  const selectedFlight = useMemo(
    () => flights.find((flight) => flight.icao24 === selectedFlightIcao) ?? null,
    [flights, selectedFlightIcao],
  )
  const highestFlight = useMemo(
    () =>
      flights.reduce<NearbyFlight | null>((currentHighest, flight) => {
        if (currentHighest === null) {
          return flight
        }

        const currentAltitude = currentHighest.altitudeMeters ?? -Infinity
        const nextAltitude = flight.altitudeMeters ?? -Infinity
        return nextAltitude > currentAltitude ? flight : currentHighest
      }, null),
    [flights],
  )

  const lastRefreshLabel = useMemo(
    () =>
      lastRefreshedAt === null ? null : formatLastRefresh(lastRefreshedAt, now),
    [lastRefreshedAt, now],
  )

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Flights</div>
          <div className={styles.subtitle}>
            {settings.flightsShowOnlyAirborne ? 'Airborne traffic' : 'Nearby traffic'} within{' '}
            {settings.flightsRadiusKm} km
          </div>
        </div>
        {!loading ? (
          <div className={styles.refreshGroup}>
            {lastRefreshLabel ? <span className={styles.refreshHint}>{lastRefreshLabel}</span> : null}
            <button
              className={styles.refresh}
              onClick={load}
              title="Refresh flights"
              aria-label="Refresh flights"
              type="button"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={styles.loading} aria-label="Loading flights">
          Loading nearby flights…
        </div>
      ) : null}

      {!loading && error ? <div className={styles.error}>{error}</div> : null}

      {!loading && !error ? (
        <div className={styles.body}>
          <div className={styles.summaryBar}>
            <span className={styles.summaryMetric}>
              <Plane size={14} />
              {flights.length} {flights.length === 1 ? 'aircraft' : 'aircraft'}
            </span>
            <span className={styles.summaryMetric}>
              <LocateFixed size={14} />
              {locationSource}
            </span>
            {nearestFlight ? (
              <span className={styles.summaryMetric}>
                <MapPin size={14} />
                {nearestFlight.distanceKm.toFixed(1)} km away
              </span>
            ) : null}
          </div>

          {flights.length === 0 ? (
            <div className={styles.emptyState}>
              No {settings.flightsShowOnlyAirborne ? 'airborne ' : ''}aircraft found within{' '}
              {settings.flightsRadiusKm} km right now.
            </div>
          ) : (
            <div className={styles.content}>
              <div className={styles.radarPanel}>
                <RadarPlot
                  flights={flights}
                  maxRadiusKm={settings.flightsRadarRadiusKm}
                  showLabels={settings.flightsShowLabels}
                  isFullscreen={isFullscreen}
                  selectedFlightIcao={selectedFlightIcao}
                  onSelectFlight={(flight) => setSelectedFlightIcao(flight.icao24)}
                />
                <div className={styles.radarCaption}>
                Centered on {locationSource.toLowerCase()} · outer ring {settings.flightsRadarRadiusKm} km
                </div>
              </div>

              <div className={styles.flightList}>
                {selectedFlight ? (
                  <div className={styles.selectedFlightCard} role="status" aria-live="polite">
                    <div className={styles.selectedFlightHeader}>
                      <span className={styles.highlightLabel}>Selected aircraft</span>
                      <span className={styles.selectedFlightName}>{getFlightName(selectedFlight)}</span>
                    </div>
                    <div className={styles.selectedFlightGrid}>
                      <span>ICAO24: {selectedFlight.icao24.toUpperCase()}</span>
                      <span>Origin: {selectedFlight.originCountry ?? 'Unknown'}</span>
                      <span>Distance: {selectedFlight.distanceKm.toFixed(1)} km</span>
                      <span>Altitude: {formatAltitude(selectedFlight.altitudeMeters)}</span>
                      <span>Speed: {formatGroundSpeed(selectedFlight.groundspeedKmh)}</span>
                      <span>Heading: {formatHeading(selectedFlight.headingDegrees)}</span>
                      <span>{formatVerticalRate(selectedFlight.verticalRateMetersPerMinute)}</span>
                      <span>Seen {selectedFlight.lastSeenSecondsAgo}s ago</span>
                    </div>
                  </div>
                ) : flights.length > 0 ? (
                  <div className={styles.selectedFlightHint}>Select an aircraft on the radar to inspect details.</div>
                ) : null}
                <div className={styles.flightHighlights}>
                  {nearestFlight ? (
                    <div className={styles.highlight}>
                      <span className={styles.highlightLabel}>Nearest</span>
                      <span className={styles.highlightValue}>
                        {getFlightName(nearestFlight)} · {nearestFlight.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                  ) : null}
                  {highestFlight ? (
                    <div className={styles.highlight}>
                      <span className={styles.highlightLabel}>Highest</span>
                      <span className={styles.highlightValue}>
                        {getFlightName(highestFlight)} · {formatAltitude(highestFlight.altitudeMeters)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className={styles.rows} role="list" aria-label="Nearby flights">
                  {flights
                    .slice(0, isFullscreen ? 12 : 5)
                    .map((flight) => (
                      <div key={flight.icao24} className={styles.row} role="listitem">
                        <div className={styles.rowHeader}>
                          <span className={styles.flightName}>{getFlightName(flight)}</span>
                          <span className={styles.flightDistance}>{flight.distanceKm.toFixed(1)} km</span>
                        </div>
                        <div className={styles.rowMeta}>
                          <span>{formatAltitude(flight.altitudeMeters)}</span>
                          <span>{formatGroundSpeed(flight.groundspeedKmh)}</span>
                          <span>{formatHeading(flight.headingDegrees)}</span>
                        </div>
                        <div className={styles.rowFooter}>
                          <span>{flight.originCountry ?? 'Unknown origin'}</span>
                          <span>Seen {flight.lastSeenSecondsAgo}s ago</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
