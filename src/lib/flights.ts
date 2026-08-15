const DEFAULT_FLIGHTS_API_BASE = import.meta.env.DEV ? '/api/flights' : 'https://api.allorigins.win/raw?url='
const KM_PER_NAUTICAL_MILE = 1.852
const METERS_PER_FOOT = 0.3048
const EARTH_RADIUS_KM = 6371
const MIN_FETCH_INTERVAL_MS = 10_000
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 30_000
const MAX_RATE_LIMIT_BACKOFF_MS = 300_000
const FLIGHTS_API_BASE = import.meta.env.VITE_FLIGHTS_API_BASE?.trim() || DEFAULT_FLIGHTS_API_BASE

interface CachedFlightPayload {
  readonly flights: NearbyFlight[]
  readonly fetchedAtMs: number
}

interface AirplanesLiveAircraft {
  readonly hex?: unknown
  readonly flight?: unknown
  readonly r?: unknown
  readonly t?: unknown
  readonly desc?: unknown
  readonly lat?: unknown
  readonly lon?: unknown
  readonly alt_baro?: unknown
  readonly alt_geom?: unknown
  readonly gs?: unknown
  readonly true_heading?: unknown
  readonly mag_heading?: unknown
  readonly track?: unknown
  readonly baro_rate?: unknown
  readonly geom_rate?: unknown
  readonly seen?: unknown
  readonly seen_pos?: unknown
}

const flightResponseCache = new Map<string, CachedFlightPayload>()
const inFlightRequests = new Map<string, Promise<NearbyFlight[]>>()
const rateLimitedUntil = new Map<string, number>()

export function resetFlightRequestCache(): void {
  flightResponseCache.clear()
  inFlightRequests.clear()
  rateLimitedUntil.clear()
}

export interface NearbyFlight {
  icao24: string
  callsign: string | null
  originCountry: string | null
  registration: string | null
  aircraftTypeCode: string | null
  aircraftDescription: string | null
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

function convertFeetToMeters(value: number | null): number | null {
  return value === null ? null : Math.round(value * METERS_PER_FOOT)
}

function convertKnotsToKmh(value: number | null): number | null {
  return value === null ? null : Math.round(value * KM_PER_NAUTICAL_MILE)
}

function convertFeetPerMinuteToMetersPerMinute(value: number | null): number | null {
  return value === null ? null : Math.round(value * METERS_PER_FOOT)
}

function parseOpenSkyFlight(
  rawState: unknown,
  snapshotTime: number,
  originLatitude: number,
  originLongitude: number,
): NearbyFlight | null {
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
    registration: null,
    aircraftTypeCode: null,
    aircraftDescription: null,
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

function parseAirplanesLiveAltitudeMeters(aircraft: AirplanesLiveAircraft): number | null {
  const geometricAltitudeFeet = parseFiniteNumber(aircraft.alt_geom)
  const barometricAltitude = aircraft.alt_baro

  if (typeof barometricAltitude === 'string' && barometricAltitude.toLowerCase() === 'ground') {
    return 0
  }

  const barometricAltitudeFeet = parseFiniteNumber(barometricAltitude)
  return convertFeetToMeters(geometricAltitudeFeet ?? barometricAltitudeFeet)
}

function parseAirplanesLiveFlight(
  rawAircraft: unknown,
  originLatitude: number,
  originLongitude: number,
): NearbyFlight | null {
  if (typeof rawAircraft !== 'object' || rawAircraft === null) {
    return null
  }

  const aircraft = rawAircraft as AirplanesLiveAircraft
  const icao24 = parseString(aircraft.hex)
  const latitude = parseFiniteNumber(aircraft.lat)
  const longitude = parseFiniteNumber(aircraft.lon)

  if (!icao24 || latitude === null || longitude === null) {
    return null
  }

  const altitudeMeters = parseAirplanesLiveAltitudeMeters(aircraft)
  const onGround =
    altitudeMeters === 0 ||
    (typeof aircraft.alt_baro === 'string' && aircraft.alt_baro.toLowerCase() === 'ground')
  const groundspeedKmh = convertKnotsToKmh(parseFiniteNumber(aircraft.gs))
  const headingDegreesSource =
    parseFiniteNumber(aircraft.true_heading) ??
    parseFiniteNumber(aircraft.mag_heading) ??
    parseFiniteNumber(aircraft.track)
  const verticalRateMetersPerMinute = convertFeetPerMinuteToMetersPerMinute(
    parseFiniteNumber(aircraft.geom_rate) ?? parseFiniteNumber(aircraft.baro_rate),
  )
  const seenSeconds =
    parseFiniteNumber(aircraft.seen) ?? parseFiniteNumber(aircraft.seen_pos) ?? 0
  const distanceKm = calculateDistanceKm(originLatitude, originLongitude, latitude, longitude)
  const bearingDegrees = calculateBearingDegrees(originLatitude, originLongitude, latitude, longitude)

  return {
    icao24,
    callsign: parseString(aircraft.flight),
    originCountry: null,
    registration: parseString(aircraft.r),
    aircraftTypeCode: parseString(aircraft.t),
    aircraftDescription: parseString(aircraft.desc),
    latitude,
    longitude,
    altitudeMeters,
    groundspeedKmh,
    headingDegrees:
      headingDegreesSource === null ? null : Math.round(normalizeDegrees(headingDegreesSource)),
    verticalRateMetersPerMinute,
    distanceKm: Math.round(distanceKm * 10) / 10,
    bearingDegrees: Math.round(bearingDegrees),
    lastSeenSecondsAgo: Math.max(0, Math.round(seenSeconds)),
    onGround,
  }
}

function buildOpenSkyFlightRequestUrl(latitude: number, longitude: number, radiusKm: number): URL {
  const latitudeDelta = Math.min(2, Math.max(0.15, radiusKm / 111))
  const longitudeDelta = Math.min(
    2,
    Math.max(0.15, radiusKm / (111 * Math.cos(toRadians(latitude)))),
  )

  const requestUrl = new URL('https://opensky-network.org/api/states/all')
  requestUrl.searchParams.set('lamin', (latitude - latitudeDelta).toFixed(4))
  requestUrl.searchParams.set('lomin', (longitude - longitudeDelta).toFixed(4))
  requestUrl.searchParams.set('lamax', (latitude + latitudeDelta).toFixed(4))
  requestUrl.searchParams.set('lomax', (longitude + longitudeDelta).toFixed(4))
  return requestUrl
}

function buildFlightRequestUrl(latitude: number, longitude: number, radiusKm: number): string {
  const openSkyUrl = buildOpenSkyFlightRequestUrl(latitude, longitude, radiusKm)

  if (/^https?:\/\//i.test(FLIGHTS_API_BASE)) {
    const baseUrl = new URL(FLIGHTS_API_BASE)

    if (baseUrl.hostname.includes('allorigins.win') && baseUrl.pathname === '/raw') {
      const proxyUrl = new URL(baseUrl.toString())
      proxyUrl.searchParams.set('url', openSkyUrl.toString())
      return proxyUrl.toString()
    }

    if (baseUrl.searchParams.has('url')) {
      const proxyUrl = new URL(baseUrl.toString())
      proxyUrl.searchParams.set('url', openSkyUrl.toString())
      return proxyUrl.toString()
    }

    const pathname = baseUrl.pathname.replace(/\/$/, '')
    baseUrl.pathname = pathname.endsWith('/api') ? `${pathname}/states/all` : pathname
    baseUrl.search = ''
    baseUrl.searchParams.set('lamin', openSkyUrl.searchParams.get('lamin') ?? '')
    baseUrl.searchParams.set('lomin', openSkyUrl.searchParams.get('lomin') ?? '')
    baseUrl.searchParams.set('lamax', openSkyUrl.searchParams.get('lamax') ?? '')
    baseUrl.searchParams.set('lomax', openSkyUrl.searchParams.get('lomax') ?? '')
    return baseUrl.toString()
  }

  const requestUrl = new URL(FLIGHTS_API_BASE, 'http://localhost')
  requestUrl.searchParams.set('lamin', openSkyUrl.searchParams.get('lamin') ?? '')
  requestUrl.searchParams.set('lomin', openSkyUrl.searchParams.get('lomin') ?? '')
  requestUrl.searchParams.set('lamax', openSkyUrl.searchParams.get('lamax') ?? '')
  requestUrl.searchParams.set('lomax', openSkyUrl.searchParams.get('lomax') ?? '')
  const relativeUrl = requestUrl.pathname + requestUrl.search
  return relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`
}

function buildRequestKey({
  latitude,
  longitude,
  radiusKm,
  onlyAirborne,
}: {
  latitude: number
  longitude: number
  radiusKm: number
  onlyAirborne: boolean
}): string {
  return [
    latitude.toFixed(2),
    longitude.toFixed(2),
    radiusKm.toFixed(1),
    onlyAirborne ? 'airborne' : 'all',
  ].join(':')
}

function parseRetryAfterMilliseconds(rawValue: string | null): number {
  if (rawValue === null) {
    return DEFAULT_RATE_LIMIT_BACKOFF_MS
  }

  const trimmedValue = rawValue.trim()
  if (trimmedValue.length === 0) {
    return DEFAULT_RATE_LIMIT_BACKOFF_MS
  }

  const numericSeconds = Number(trimmedValue)
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.min(Math.round(numericSeconds * 1000), MAX_RATE_LIMIT_BACKOFF_MS)
  }

  const retryAtMs = Date.parse(trimmedValue)
  if (Number.isNaN(retryAtMs)) {
    return DEFAULT_RATE_LIMIT_BACKOFF_MS
  }

  return Math.min(
    Math.max(0, retryAtMs - Date.now()),
    MAX_RATE_LIMIT_BACKOFF_MS,
  )
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
  const requestArgs = { latitude, longitude, radiusKm, onlyAirborne }
  const requestKey = buildRequestKey(requestArgs)
  const nowMs = Date.now()
  const cachedPayload = flightResponseCache.get(requestKey)
  const cachedAgeMs = cachedPayload === undefined ? Infinity : nowMs - cachedPayload.fetchedAtMs
  const blockedUntilMs = rateLimitedUntil.get(requestKey) ?? 0

  if (cachedPayload !== undefined) {
    if (cachedAgeMs < MIN_FETCH_INTERVAL_MS) {
      return cachedPayload.flights
    }

    if (blockedUntilMs > nowMs) {
      return cachedPayload.flights
    }
  }

  const existingRequest = inFlightRequests.get(requestKey)
  if (existingRequest !== undefined) {
    return existingRequest
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(buildFlightRequestUrl(latitude, longitude, radiusKm))
      if (response.status === 429) {
        const backoffMs = parseRetryAfterMilliseconds(response.headers.get('retry-after'))
        rateLimitedUntil.set(requestKey, Date.now() + backoffMs)
        if (cachedPayload !== undefined) {
          return cachedPayload.flights
        }
        throw new Error('Flight data is temporarily rate-limited. Please try again soon.')
      }

      if (!response.ok) {
        throw new Error('Could not load nearby flights.')
      }

      const payload = (await response.json()) as { time?: unknown; states?: unknown; ac?: unknown }
      const snapshotTime =
        typeof payload.time === 'number' && Number.isFinite(payload.time)
          ? payload.time
          : Math.floor(Date.now() / 1000)

      let flights: NearbyFlight[]
      if (Array.isArray(payload.states)) {
        flights = payload.states
          .map((rawState) => parseOpenSkyFlight(rawState, snapshotTime, latitude, longitude))
          .filter((flight): flight is NearbyFlight => flight !== null)
      } else {
        const aircraft = Array.isArray(payload.ac) ? payload.ac : []
        flights = aircraft
          .map((rawAircraft) => parseAirplanesLiveFlight(rawAircraft, latitude, longitude))
          .filter((flight): flight is NearbyFlight => flight !== null)
      }

      const filteredFlights = flights
        .filter((flight) => flight.lastSeenSecondsAgo <= 120)
        .filter((flight) => flight.distanceKm <= radiusKm)
        .filter((flight) => !onlyAirborne || !flight.onGround)
        .sort((left, right) => left.distanceKm - right.distanceKm)

      flightResponseCache.set(requestKey, { flights: filteredFlights, fetchedAtMs: Date.now() })
      rateLimitedUntil.delete(requestKey)
      return filteredFlights
    } catch (error: unknown) {
      if (cachedPayload !== undefined) {
        return cachedPayload.flights
      }
      throw error
    } finally {
      inFlightRequests.delete(requestKey)
    }
  })()

  inFlightRequests.set(requestKey, requestPromise)
  return requestPromise
}
