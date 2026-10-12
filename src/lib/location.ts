export interface Coordinates {
  latitude: number
  longitude: number
}

const GEOLOCATION_PERMISSION_DENIED = 1
// Without a timeout, an ignored permission prompt leaves widgets loading forever.
const GEOLOCATION_TIMEOUT_MS = 10_000
const GEOLOCATION_MAX_AGE_MS = 5 * 60_000

export function getLocationErrorMessage(error: { code?: number } | null, purpose: string): string {
  if (error?.code === GEOLOCATION_PERMISSION_DENIED) {
    return `Location access denied. Enable location to see ${purpose}.`
  }
  return 'Location is temporarily unavailable. Try again in a moment.'
}

/** Promise wrapper around geolocation with a timeout and a user-facing error message. */
export function getCurrentLocation(purpose: string): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is unavailable in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(getLocationErrorMessage(error, purpose))),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: GEOLOCATION_MAX_AGE_MS },
    )
  })
}

/** Parses manual coordinates strictly: "12abc" is rejected, not read as 12. */
export function parseCoordinates(latitude: string, longitude: string): Coordinates | null {
  if (!latitude.trim() || !longitude.trim()) return null
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { latitude: lat, longitude: lon }
}

// Nominatim allows about one request per second, so place names are cached by
// rounded coordinates (~1 km) and shared by every widget.
const placeNameCache = new Map<string, Promise<string | null>>()

function cacheKey({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}

/** City name for coordinates, or null when the lookup fails. Never throws. */
export function reverseGeocode(coordinates: Coordinates): Promise<string | null> {
  const key = cacheKey(coordinates)
  const cached = placeNameCache.get(key)
  if (cached) return cached

  const lookup = (async () => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const geo = (await response.json()) as { address?: Record<string, string | undefined> }
    return geo.address?.city ?? geo.address?.town ?? geo.address?.village ?? geo.address?.county ?? null
  })().catch(() => {
    // Forget failures so a later refresh can try again.
    placeNameCache.delete(key)
    return null
  })

  placeNameCache.set(key, lookup)
  return lookup
}

export function clearPlaceNameCache(): void {
  placeNameCache.clear()
}
