// Low-precision sun and moon positions (accurate to well under a degree),
// following the standard formulas in Meeus, "Astronomical Algorithms", as
// popularised by astronomy-answers and SunCalc.

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2_440_588
const J2000 = 2_451_545
const OBLIQUITY = RAD * 23.4397

export interface HorizontalPosition {
  /** Degrees above the horizon (negative below). */
  altitude: number
  /** Compass bearing in degrees, clockwise from north. */
  azimuth: number
}

function toDays(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970 - J2000
}

function rightAscension(longitude: number, latitude: number): number {
  return Math.atan2(
    Math.sin(longitude) * Math.cos(OBLIQUITY) - Math.tan(latitude) * Math.sin(OBLIQUITY),
    Math.cos(longitude),
  )
}

function declination(longitude: number, latitude: number): number {
  return Math.asin(
    Math.sin(latitude) * Math.cos(OBLIQUITY) + Math.cos(latitude) * Math.sin(OBLIQUITY) * Math.sin(longitude),
  )
}

function siderealTime(days: number, westLongitude: number): number {
  return RAD * (280.16 + 360.9856235 * days) - westLongitude
}

function toHorizontal(hourAngle: number, latitude: number, dec: number): HorizontalPosition {
  const altitude = Math.asin(
    Math.sin(latitude) * Math.sin(dec) + Math.cos(latitude) * Math.cos(dec) * Math.cos(hourAngle),
  )
  // Azimuth measured from south, westward; converted to a compass bearing below.
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(dec) * Math.cos(latitude),
  )
  return {
    altitude: altitude / RAD,
    azimuth: (((fromSouth / RAD + 180) % 360) + 360) % 360,
  }
}

function sunCoordinates(days: number) {
  const meanAnomaly = RAD * (357.5291 + 0.98560028 * days)
  const center =
    RAD * (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly))
  const perihelion = RAD * 102.9372
  const eclipticLongitude = meanAnomaly + center + perihelion + Math.PI
  return { dec: declination(eclipticLongitude, 0), ra: rightAscension(eclipticLongitude, 0) }
}

function moonCoordinates(days: number) {
  const meanLongitude = RAD * (218.316 + 13.176396 * days)
  const meanAnomaly = RAD * (134.963 + 13.064993 * days)
  const meanDistance = RAD * (93.272 + 13.22935 * days)
  const longitude = meanLongitude + RAD * 6.289 * Math.sin(meanAnomaly)
  const latitude = RAD * 5.128 * Math.sin(meanDistance)
  return { dec: declination(longitude, latitude), ra: rightAscension(longitude, latitude) }
}

/** Atmospheric refraction lifts objects near the horizon by about half a degree. */
function withRefraction(altitudeDegrees: number): number {
  const h = Math.max(altitudeDegrees, 0) * RAD
  return altitudeDegrees + (0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))) / RAD
}

export function getSunPosition(date: Date, latitude: number, longitude: number): HorizontalPosition {
  const days = toDays(date)
  const { ra, dec } = sunCoordinates(days)
  return toHorizontal(siderealTime(days, -longitude * RAD) - ra, latitude * RAD, dec)
}

export function getMoonPosition(date: Date, latitude: number, longitude: number): HorizontalPosition {
  const days = toDays(date)
  const { ra, dec } = moonCoordinates(days)
  const position = toHorizontal(siderealTime(days, -longitude * RAD) - ra, latitude * RAD, dec)
  return { ...position, altitude: withRefraction(position.altitude) }
}

/** The sun's centre is at -0.833° at sunrise and sunset (refraction plus its radius). */
export const SUN_HORIZON_ALTITUDE = -0.833
