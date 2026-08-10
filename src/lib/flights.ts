const FLIGHTS_PROXY_PATH = '/api/flights'
const EARTH_RADIUS_KM = 6371

export interface NearbyFlight {
  icao24: string
  callsign: string | null
  originCountry: string | null
  latitude: number
  longitude: number
  altitudeMeters: number | null
  groundspeedKmh: number | null
  headingDegrees: number | null
  verticalRateMetersPerMinute: number | null
  distanceKm: number
  bearingDegrees: number
  lastSeenSecondsAgo: number
  onGround: boolean
}

interface FlightBounds {
  lamin: number
  lomin: number
  lamax: number
  lomax: number
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function normalizeDegrees(value: number): number {
  return (value + 360) % 360
}

function calculateDistanceKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const latitudeDelta = toRadians(destinationLatitude - originLatitude)
  const longitudeDelta = toRadians(destinationLongitude - originLongitude)
  const originLatitudeRad = toRadians(originLatitude)
  const destinationLatitudeRad = toRadians(destinationLatitude)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitudeRad) *
      Math.cos(destinationLatitudeRad) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function calculateBearingDegrees(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const originLatitudeRad = toRadians(originLatitude)
  const destinationLatitudeRad = toRadians(destinationLatitude)
  const longitudeDeltaRad = toRadians(destinationLongitude - originLongitude)

  const y = Math.sin(longitudeDeltaRad) * Math.cos(destinationLatitudeRad)
  const x =
    Math.cos(originLatitudeRad) * Math.sin(destinationLatitudeRad) -
    Math.sin(originLatitudeRad) *
      Math.cos(destinationLatitudeRad) *
      Math.cos(longitudeDeltaRad)

  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI)
}

function buildFlightBounds(latitude: number, longitude: number, radiusKm: number): FlightBounds {
  const latitudeDelta = radiusKm / 111
  const longitudeScale = Math.max(Math.cos(toRadians(latitude)), 0.2)
  const longitudeDelta = radiusKm / (111 * longitudeScale)

  return {
    lamin: Math.max(-90, latitude - latitudeDelta),
    lomin: Math.max(-180, longitude - longitudeDelta),
    lamax: Math.min(90, latitude + latitudeDelta),
    lomax: Math.min(180, longitude + longitudeDelta),
  }
}

function parseFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseFlight(rawState: unknown, snapshotTime: number, originLatitude: number, originLongitude: number): NearbyFlight | null {
  if (!Array.isArray(rawState)) {
    return null
  }

  const icao24 = parseString(rawState[0])
  const longitude = parseFiniteNumber(rawState[5])
  const latitude = parseFiniteNumber(rawState[6])

  if (!icao24 || longitude === null || latitude === null) {
    return null
  }

  const baroAltitudeMeters = parseFiniteNumber(rawState[7])
  const onGround = rawState[8] === true
  const velocityMetersPerSecond = parseFiniteNumber(rawState[9])
  const headingDegrees = parseFiniteNumber(rawState[10])
  const verticalRateMetersPerSecond = parseFiniteNumber(rawState[11])
  const geoAltitudeMeters = parseFiniteNumber(rawState[13])
  const lastContact = parseFiniteNumber(rawState[4])
  const altitudeMeters = geoAltitudeMeters ?? baroAltitudeMeters
  const distanceKm = calculateDistanceKm(originLatitude, originLongitude, latitude, longitude)
  const bearingDegrees = calculateBearingDegrees(originLatitude, originLongitude, latitude, longitude)

  return {
    icao24,
    callsign: parseString(rawState[1]),
    originCountry: parseString(rawState[2]),
    latitude,
    longitude,
    altitudeMeters,
    groundspeedKmh: velocityMetersPerSecond === null ? null : Math.round(velocityMetersPerSecond * 3.6),
    headingDegrees: headingDegrees === null ? null : Math.round(normalizeDegrees(headingDegrees)),
    verticalRateMetersPerMinute:
      verticalRateMetersPerSecond === null
        ? null
        : Math.round(verticalRateMetersPerSecond * 60),
    distanceKm: Math.round(distanceKm * 10) / 10,
    bearingDegrees: Math.round(bearingDegrees),
    lastSeenSecondsAgo:
      lastContact === null ? 0 : Math.max(0, Math.round(snapshotTime - lastContact)),
    onGround,
  }
}

function buildFlightRequestUrl(bounds: FlightBounds): string {
  const params = new URLSearchParams({
    lamin: bounds.lamin.toFixed(4),
    lomin: bounds.lomin.toFixed(4),
    lamax: bounds.lamax.toFixed(4),
    lomax: bounds.lomax.toFixed(4),
  })

  return `${FLIGHTS_PROXY_PATH}?${params.toString()}`
}

export async function fetchNearbyFlights({
  latitude,
  longitude,
  radiusKm,
  onlyAirborne,
}: {
  latitude: number
  longitude: number
  radiusKm: number
  onlyAirborne: boolean
}): Promise<NearbyFlight[]> {
  const response = await fetch(buildFlightRequestUrl(buildFlightBounds(latitude, longitude, radiusKm)))
  if (!response.ok) {
    throw new Error('Could not load nearby flights.')
  }

  const payload = (await response.json()) as { time?: unknown; states?: unknown }
  const snapshotTime =
    typeof payload.time === 'number' && Number.isFinite(payload.time)
      ? payload.time
      : Math.floor(Date.now() / 1000)
  const rawStates = Array.isArray(payload.states) ? payload.states : []

  return rawStates
    .map((rawState) => parseFlight(rawState, snapshotTime, latitude, longitude))
    .filter((flight): flight is NearbyFlight => flight !== null)
    .filter((flight) => flight.lastSeenSecondsAgo <= 120)
    .filter((flight) => flight.distanceKm <= radiusKm)
    .filter((flight) => !onlyAirborne || !flight.onGround)
    .sort((left, right) => left.distanceKm - right.distanceKm)
}
