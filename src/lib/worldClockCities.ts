export interface WorldClockCity {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly timeZone: string
  readonly latitude: number
  readonly longitude: number
}

// Coordinates are only used for the map dot and sunrise/sunset, so two
// decimals (about 1 km) is plenty.
export const WORLD_CLOCK_CITIES: ReadonlyArray<WorldClockCity> = [
  { id: 'honolulu', name: 'Honolulu', country: 'United States', timeZone: 'Pacific/Honolulu', latitude: 21.31, longitude: -157.86 },
  { id: 'anchorage', name: 'Anchorage', country: 'United States', timeZone: 'America/Anchorage', latitude: 61.22, longitude: -149.9 },
  { id: 'vancouver', name: 'Vancouver', country: 'Canada', timeZone: 'America/Vancouver', latitude: 49.28, longitude: -123.12 },
  { id: 'seattle', name: 'Seattle', country: 'United States', timeZone: 'America/Los_Angeles', latitude: 47.61, longitude: -122.33 },
  { id: 'san-francisco', name: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles', latitude: 37.77, longitude: -122.42 },
  { id: 'cupertino', name: 'Cupertino', country: 'United States', timeZone: 'America/Los_Angeles', latitude: 37.32, longitude: -122.03 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'United States', timeZone: 'America/Los_Angeles', latitude: 34.05, longitude: -118.24 },
  { id: 'las-vegas', name: 'Las Vegas', country: 'United States', timeZone: 'America/Los_Angeles', latitude: 36.17, longitude: -115.14 },
  { id: 'phoenix', name: 'Phoenix', country: 'United States', timeZone: 'America/Phoenix', latitude: 33.45, longitude: -112.07 },
  { id: 'denver', name: 'Denver', country: 'United States', timeZone: 'America/Denver', latitude: 39.74, longitude: -104.99 },
  { id: 'calgary', name: 'Calgary', country: 'Canada', timeZone: 'America/Edmonton', latitude: 51.05, longitude: -114.07 },
  { id: 'mexico-city', name: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City', latitude: 19.43, longitude: -99.13 },
  { id: 'dallas', name: 'Dallas', country: 'United States', timeZone: 'America/Chicago', latitude: 32.78, longitude: -96.8 },
  { id: 'houston', name: 'Houston', country: 'United States', timeZone: 'America/Chicago', latitude: 29.76, longitude: -95.37 },
  { id: 'chicago', name: 'Chicago', country: 'United States', timeZone: 'America/Chicago', latitude: 41.88, longitude: -87.63 },
  { id: 'toronto', name: 'Toronto', country: 'Canada', timeZone: 'America/Toronto', latitude: 43.65, longitude: -79.38 },
  { id: 'montreal', name: 'Montreal', country: 'Canada', timeZone: 'America/Toronto', latitude: 45.5, longitude: -73.57 },
  { id: 'atlanta', name: 'Atlanta', country: 'United States', timeZone: 'America/New_York', latitude: 33.75, longitude: -84.39 },
  { id: 'miami', name: 'Miami', country: 'United States', timeZone: 'America/New_York', latitude: 25.76, longitude: -80.19 },
  { id: 'washington', name: 'Washington, D.C.', country: 'United States', timeZone: 'America/New_York', latitude: 38.91, longitude: -77.04 },
  { id: 'new-york', name: 'New York', country: 'United States', timeZone: 'America/New_York', latitude: 40.71, longitude: -74.01 },
  { id: 'boston', name: 'Boston', country: 'United States', timeZone: 'America/New_York', latitude: 42.36, longitude: -71.06 },
  { id: 'havana', name: 'Havana', country: 'Cuba', timeZone: 'America/Havana', latitude: 23.11, longitude: -82.37 },
  { id: 'bogota', name: 'Bogotá', country: 'Colombia', timeZone: 'America/Bogota', latitude: 4.71, longitude: -74.07 },
  { id: 'lima', name: 'Lima', country: 'Peru', timeZone: 'America/Lima', latitude: -12.05, longitude: -77.04 },
  { id: 'caracas', name: 'Caracas', country: 'Venezuela', timeZone: 'America/Caracas', latitude: 10.48, longitude: -66.9 },
  { id: 'halifax', name: 'Halifax', country: 'Canada', timeZone: 'America/Halifax', latitude: 44.65, longitude: -63.57 },
  { id: 'santiago', name: 'Santiago', country: 'Chile', timeZone: 'America/Santiago', latitude: -33.45, longitude: -70.67 },
  { id: 'st-johns', name: "St. John's", country: 'Canada', timeZone: 'America/St_Johns', latitude: 47.56, longitude: -52.71 },
  { id: 'buenos-aires', name: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', latitude: -34.6, longitude: -58.38 },
  { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', timeZone: 'America/Sao_Paulo', latitude: -23.55, longitude: -46.63 },
  { id: 'rio-de-janeiro', name: 'Rio de Janeiro', country: 'Brazil', timeZone: 'America/Sao_Paulo', latitude: -22.91, longitude: -43.17 },
  { id: 'nuuk', name: 'Nuuk', country: 'Greenland', timeZone: 'America/Nuuk', latitude: 64.18, longitude: -51.72 },
  { id: 'reykjavik', name: 'Reykjavík', country: 'Iceland', timeZone: 'Atlantic/Reykjavik', latitude: 64.15, longitude: -21.94 },
  { id: 'lisbon', name: 'Lisbon', country: 'Portugal', timeZone: 'Europe/Lisbon', latitude: 38.72, longitude: -9.14 },
  { id: 'dublin', name: 'Dublin', country: 'Ireland', timeZone: 'Europe/Dublin', latitude: 53.35, longitude: -6.26 },
  { id: 'london', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London', latitude: 51.51, longitude: -0.13 },
  { id: 'casablanca', name: 'Casablanca', country: 'Morocco', timeZone: 'Africa/Casablanca', latitude: 33.57, longitude: -7.59 },
  { id: 'dakar', name: 'Dakar', country: 'Senegal', timeZone: 'Africa/Dakar', latitude: 14.69, longitude: -17.44 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', timeZone: 'Africa/Lagos', latitude: 6.52, longitude: 3.38 },
  { id: 'madrid', name: 'Madrid', country: 'Spain', timeZone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', timeZone: 'Europe/Madrid', latitude: 41.39, longitude: 2.17 },
  { id: 'paris', name: 'Paris', country: 'France', timeZone: 'Europe/Paris', latitude: 48.86, longitude: 2.35 },
  { id: 'brussels', name: 'Brussels', country: 'Belgium', timeZone: 'Europe/Brussels', latitude: 50.85, longitude: 4.35 },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', timeZone: 'Europe/Amsterdam', latitude: 52.37, longitude: 4.9 },
  { id: 'zurich', name: 'Zurich', country: 'Switzerland', timeZone: 'Europe/Zurich', latitude: 47.38, longitude: 8.54 },
  { id: 'milan', name: 'Milan', country: 'Italy', timeZone: 'Europe/Rome', latitude: 45.46, longitude: 9.19 },
  { id: 'rome', name: 'Rome', country: 'Italy', timeZone: 'Europe/Rome', latitude: 41.9, longitude: 12.5 },
  { id: 'berlin', name: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin', latitude: 52.52, longitude: 13.41 },
  { id: 'munich', name: 'Munich', country: 'Germany', timeZone: 'Europe/Berlin', latitude: 48.14, longitude: 11.58 },
  { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark', timeZone: 'Europe/Copenhagen', latitude: 55.68, longitude: 12.57 },
  { id: 'oslo', name: 'Oslo', country: 'Norway', timeZone: 'Europe/Oslo', latitude: 59.91, longitude: 10.75 },
  { id: 'stockholm', name: 'Stockholm', country: 'Sweden', timeZone: 'Europe/Stockholm', latitude: 59.33, longitude: 18.07 },
  { id: 'prague', name: 'Prague', country: 'Czechia', timeZone: 'Europe/Prague', latitude: 50.08, longitude: 14.44 },
  { id: 'vienna', name: 'Vienna', country: 'Austria', timeZone: 'Europe/Vienna', latitude: 48.21, longitude: 16.37 },
  { id: 'budapest', name: 'Budapest', country: 'Hungary', timeZone: 'Europe/Budapest', latitude: 47.5, longitude: 19.04 },
  { id: 'warsaw', name: 'Warsaw', country: 'Poland', timeZone: 'Europe/Warsaw', latitude: 52.23, longitude: 21.01 },
  { id: 'belgrade', name: 'Belgrade', country: 'Serbia', timeZone: 'Europe/Belgrade', latitude: 44.79, longitude: 20.45 },
  { id: 'bucharest', name: 'Bucharest', country: 'Romania', timeZone: 'Europe/Bucharest', latitude: 44.43, longitude: 26.1 },
  { id: 'athens', name: 'Athens', country: 'Greece', timeZone: 'Europe/Athens', latitude: 37.98, longitude: 23.73 },
  { id: 'helsinki', name: 'Helsinki', country: 'Finland', timeZone: 'Europe/Helsinki', latitude: 60.17, longitude: 24.94 },
  { id: 'kyiv', name: 'Kyiv', country: 'Ukraine', timeZone: 'Europe/Kyiv', latitude: 50.45, longitude: 30.52 },
  { id: 'istanbul', name: 'Istanbul', country: 'Türkiye', timeZone: 'Europe/Istanbul', latitude: 41.01, longitude: 28.98 },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', timeZone: 'Africa/Cairo', latitude: 30.04, longitude: 31.24 },
  { id: 'johannesburg', name: 'Johannesburg', country: 'South Africa', timeZone: 'Africa/Johannesburg', latitude: -26.2, longitude: 28.05 },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', timeZone: 'Africa/Johannesburg', latitude: -33.92, longitude: 18.42 },
  { id: 'jerusalem', name: 'Jerusalem', country: 'Israel', timeZone: 'Asia/Jerusalem', latitude: 31.77, longitude: 35.21 },
  { id: 'moscow', name: 'Moscow', country: 'Russia', timeZone: 'Europe/Moscow', latitude: 55.76, longitude: 37.62 },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', timeZone: 'Africa/Nairobi', latitude: -1.29, longitude: 36.82 },
  { id: 'riyadh', name: 'Riyadh', country: 'Saudi Arabia', timeZone: 'Asia/Riyadh', latitude: 24.71, longitude: 46.68 },
  { id: 'tehran', name: 'Tehran', country: 'Iran', timeZone: 'Asia/Tehran', latitude: 35.69, longitude: 51.39 },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', timeZone: 'Asia/Dubai', latitude: 25.2, longitude: 55.27 },
  { id: 'kabul', name: 'Kabul', country: 'Afghanistan', timeZone: 'Asia/Kabul', latitude: 34.56, longitude: 69.21 },
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', timeZone: 'Asia/Karachi', latitude: 24.86, longitude: 67.01 },
  { id: 'tashkent', name: 'Tashkent', country: 'Uzbekistan', timeZone: 'Asia/Tashkent', latitude: 41.3, longitude: 69.24 },
  { id: 'mumbai', name: 'Mumbai', country: 'India', timeZone: 'Asia/Kolkata', latitude: 19.08, longitude: 72.88 },
  { id: 'new-delhi', name: 'New Delhi', country: 'India', timeZone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 },
  { id: 'bengaluru', name: 'Bengaluru', country: 'India', timeZone: 'Asia/Kolkata', latitude: 12.97, longitude: 77.59 },
  { id: 'kathmandu', name: 'Kathmandu', country: 'Nepal', timeZone: 'Asia/Kathmandu', latitude: 27.72, longitude: 85.32 },
  { id: 'dhaka', name: 'Dhaka', country: 'Bangladesh', timeZone: 'Asia/Dhaka', latitude: 23.81, longitude: 90.41 },
  { id: 'yangon', name: 'Yangon', country: 'Myanmar', timeZone: 'Asia/Yangon', latitude: 16.87, longitude: 96.2 },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', timeZone: 'Asia/Bangkok', latitude: 13.76, longitude: 100.5 },
  { id: 'ho-chi-minh-city', name: 'Ho Chi Minh City', country: 'Vietnam', timeZone: 'Asia/Ho_Chi_Minh', latitude: 10.82, longitude: 106.63 },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', timeZone: 'Asia/Jakarta', latitude: -6.21, longitude: 106.85 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore', latitude: 1.35, longitude: 103.82 },
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', country: 'Malaysia', timeZone: 'Asia/Kuala_Lumpur', latitude: 3.14, longitude: 101.69 },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China', timeZone: 'Asia/Hong_Kong', latitude: 22.32, longitude: 114.17 },
  { id: 'manila', name: 'Manila', country: 'Philippines', timeZone: 'Asia/Manila', latitude: 14.6, longitude: 120.98 },
  { id: 'taipei', name: 'Taipei', country: 'Taiwan', timeZone: 'Asia/Taipei', latitude: 25.03, longitude: 121.57 },
  { id: 'shanghai', name: 'Shanghai', country: 'China', timeZone: 'Asia/Shanghai', latitude: 31.23, longitude: 121.47 },
  { id: 'beijing', name: 'Beijing', country: 'China', timeZone: 'Asia/Shanghai', latitude: 39.9, longitude: 116.41 },
  { id: 'perth', name: 'Perth', country: 'Australia', timeZone: 'Australia/Perth', latitude: -31.95, longitude: 115.86 },
  { id: 'seoul', name: 'Seoul', country: 'South Korea', timeZone: 'Asia/Seoul', latitude: 37.57, longitude: 126.98 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo', latitude: 35.68, longitude: 139.69 },
  { id: 'osaka', name: 'Osaka', country: 'Japan', timeZone: 'Asia/Tokyo', latitude: 34.69, longitude: 135.5 },
  { id: 'darwin', name: 'Darwin', country: 'Australia', timeZone: 'Australia/Darwin', latitude: -12.46, longitude: 130.84 },
  { id: 'adelaide', name: 'Adelaide', country: 'Australia', timeZone: 'Australia/Adelaide', latitude: -34.93, longitude: 138.6 },
  { id: 'brisbane', name: 'Brisbane', country: 'Australia', timeZone: 'Australia/Brisbane', latitude: -27.47, longitude: 153.03 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney', latitude: -33.87, longitude: 151.21 },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', timeZone: 'Australia/Melbourne', latitude: -37.81, longitude: 144.96 },
  { id: 'auckland', name: 'Auckland', country: 'New Zealand', timeZone: 'Pacific/Auckland', latitude: -36.85, longitude: 174.76 },
  { id: 'fiji', name: 'Suva', country: 'Fiji', timeZone: 'Pacific/Fiji', latitude: -18.14, longitude: 178.44 },
]

const CITIES_BY_ID = new Map(WORLD_CLOCK_CITIES.map((city) => [city.id, city]))

export function getWorldClockCity(id: string): WorldClockCity | undefined {
  return CITIES_BY_ID.get(id)
}

/**
 * The catalog city that best matches a time zone: the one with `name` if
 * given, then the one the zone is named after (New York for
 * America/New_York), then any city in that zone.
 */
export function findWorldClockCityByTimeZone(timeZone: string, name?: string): WorldClockCity | undefined {
  const inZone = WORLD_CLOCK_CITIES.filter((city) => city.timeZone === timeZone)
  const wantedName = normalizeSearchText(name ?? '')
  const zoneCity = normalizeSearchText(timeZone.split('/').pop() ?? '')
  return (
    (wantedName ? inZone.find((city) => normalizeSearchText(city.name) === wantedName) : undefined) ??
    inZone.find((city) => normalizeSearchText(city.name) === zoneCity) ??
    inZone[0]
  )
}

export function searchWorldClockCities(query: string): WorldClockCity[] {
  const needle = normalizeSearchText(query)
  const byName = (left: WorldClockCity, right: WorldClockCity) => left.name.localeCompare(right.name)
  if (!needle) {
    return [...WORLD_CLOCK_CITIES].sort(byName)
  }

  // Match the start of a word, so "to" finds Tokyo and Cape Town but not
  // Boston, and "york" still finds New York.
  const matchesWordStart = (value: string) => {
    const text = normalizeSearchText(value)
    return text.startsWith(needle) || text.split(/[\s/,.'-]+/).some((word) => word.startsWith(needle))
  }
  const rank = (city: WorldClockCity) => {
    if (normalizeSearchText(city.name).startsWith(needle)) return 0
    if (matchesWordStart(city.name)) return 1
    if (matchesWordStart(city.country)) return 2
    return 3
  }

  return WORLD_CLOCK_CITIES.filter((city) => [city.name, city.country, city.timeZone].some(matchesWordStart)).sort(
    (left, right) => rank(left) - rank(right) || byName(left, right),
  )
}

// Accent-insensitive so "sao" finds São Paulo and "bogota" finds Bogotá.
function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim()
}
