import { getSubsolarPoint, SUN_HORIZON_ALTITUDE, type GeoPoint } from './celestial'
import { getClockHourCycleOptions, type ClockHourFormat } from './settings'
import { WORLD_MAP_CELL_DEGREES, WORLD_MAP_NORTH, WORLD_MAP_ROWS, WORLD_MAP_SOUTH } from './worldMapDots'

const RAD = Math.PI / 180
const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

export interface ZonedTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>()

function getZonedFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? ''
  let formatter = zonedFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      // h23 rather than hour12: false, which some engines render as "24" at midnight.
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    zonedFormatters.set(key, formatter)
  }
  return formatter
}

/** Wall-clock fields of `date` in `timeZone` (the device zone when omitted). */
export function getZonedTime(date: Date, timeZone?: string): ZonedTime {
  const fields: Record<string, number> = {}
  for (const part of getZonedFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') {
      fields[part.type] = Number(part.value)
    }
  }
  return {
    year: fields.year,
    month: fields.month,
    day: fields.day,
    hour: fields.hour,
    minute: fields.minute,
    second: fields.second,
  }
}

/** Minutes `timeZone` is ahead of UTC at `date`. */
export function getTimeZoneOffsetMinutes(date: Date, timeZone?: string): number {
  const zoned = getZonedTime(date, timeZone)
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second)
  // Drop the milliseconds Intl ignores so the offset comes out in whole minutes.
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE_MS)
}

/** -1, 0 or 1 when the calendar date in `timeZone` is behind, equal to or ahead of the device's. */
export function getRelativeDay(date: Date, timeZone: string, localTimeZone?: string): number {
  const there = getZonedTime(date, timeZone)
  const here = getZonedTime(date, localTimeZone)
  return Math.round(
    (Date.UTC(there.year, there.month - 1, there.day) - Date.UTC(here.year, here.month - 1, here.day)) / DAY_MS,
  )
}

const cityTimeFormatters = new Map<string, Intl.DateTimeFormat>()

/** Hours and minutes in `timeZone`, following the clock's 12/24-hour setting. */
export function formatCityTime(date: Date, timeZone: string, hourFormat: ClockHourFormat): string {
  const key = `${timeZone}|${hourFormat}`
  let formatter = cityTimeFormatters.get(key)
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      ...getClockHourCycleOptions(hourFormat),
    }
    formatter = new Intl.DateTimeFormat(undefined, options)
    // Like Apple: "9:41 AM" on a 12-hour clock but "09:41" on a 24-hour one.
    const { hourCycle } = formatter.resolvedOptions()
    if (hourCycle === 'h23' || hourCycle === 'h24') {
      formatter = new Intl.DateTimeFormat(undefined, { ...options, hour: '2-digit' })
    }
    cityTimeFormatters.set(key, formatter)
  }
  // Match the rest of the app, which uses a plain space before AM/PM.
  return formatter.format(date).replace(/\u202f/g, ' ')
}

export function formatRelativeDay(relativeDay: number): string {
  const text = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(relativeDay, 'day')
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

/** Apple-style hour difference: "+0 HRS", "+1 HR", "-5:30 HRS". */
export function formatHourOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  const amount = minutes === 0 ? String(hours) : `${hours}:${String(minutes).padStart(2, '0')}`
  return `${sign}${amount} ${absolute === 60 ? 'HR' : 'HRS'}`
}

/** Sine of the sun's altitude at a point, given where the sun is overhead. */
function sunAltitudeSine(latitude: number, longitude: number, subsolar: GeoPoint): number {
  const lat = latitude * RAD
  const dec = subsolar.latitude * RAD
  return (
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos((longitude - subsolar.longitude) * RAD)
  )
}

const HORIZON_SINE = Math.sin(SUN_HORIZON_ALTITUDE * RAD)

export function isDaylight(latitude: number, longitude: number, subsolar: GeoPoint): boolean {
  return sunAltitudeSine(latitude, longitude, subsolar) > HORIZON_SINE
}

export interface SunTimes {
  sunrise: Date | null
  sunset: Date | null
}

/**
 * Sunrise and sunset on the current local day in `timeZone`. Either is null
 * when it doesn't happen that day (polar day or night).
 */
export function getSunTimes(date: Date, latitude: number, longitude: number, timeZone: string): SunTimes {
  const offsetMs = getTimeZoneOffsetMinutes(date, timeZone) * MINUTE_MS
  const dayStart = Math.floor((date.getTime() + offsetMs) / DAY_MS) * DAY_MS - offsetMs
  const step = 10 * MINUTE_MS
  const altitudeAt = (time: number) => sunAltitudeSine(latitude, longitude, getSubsolarPoint(new Date(time))) - HORIZON_SINE

  // Narrow a sign change down to about a second.
  const refine = (low: number, high: number, rising: boolean) => {
    while (high - low > 1000) {
      const middle = (low + high) / 2
      if (altitudeAt(middle) > 0 === rising) {
        high = middle
      } else {
        low = middle
      }
    }
    return new Date(Math.round(high))
  }

  let sunrise: Date | null = null
  let sunset: Date | null = null
  let previous = altitudeAt(dayStart)
  for (let time = dayStart + step; time <= dayStart + DAY_MS; time += step) {
    const current = altitudeAt(time)
    if (!sunrise && previous <= 0 && current > 0) {
      sunrise = refine(time - step, time, true)
    } else if (!sunset && previous > 0 && current <= 0) {
      sunset = refine(time - step, time, false)
    }
    previous = current
  }
  return { sunrise, sunset }
}

// ── Map geometry ─────────────────────────────────────────────
// The map is an equirectangular projection in degrees: x runs 0–360 from
// 180°W and y runs from WORLD_MAP_NORTH down to WORLD_MAP_SOUTH.

export const WORLD_MAP_WIDTH = 360
export const WORLD_MAP_HEIGHT = WORLD_MAP_NORTH - WORLD_MAP_SOUTH

/** Position on the map as fractions (0–1) of its width and height. */
export function projectToMap(latitude: number, longitude: number): { x: number; y: number } {
  const clampedLatitude = Math.min(WORLD_MAP_NORTH, Math.max(WORLD_MAP_SOUTH, latitude))
  return {
    x: (longitude + 180) / WORLD_MAP_WIDTH,
    y: (WORLD_MAP_NORTH - clampedLatitude) / WORLD_MAP_HEIGHT,
  }
}

/** SVG path data for the land dots, split by whether the sun is up there. */
export function buildMapDotPaths(subsolar: GeoPoint): { day: string; night: string } {
  const cell = WORLD_MAP_CELL_DEGREES
  const radius = cell * 0.34
  const day: string[] = []
  const night: string[] = []

  WORLD_MAP_ROWS.forEach((row, rowIndex) => {
    const latitude = WORLD_MAP_NORTH - (rowIndex + 0.5) * cell
    for (let column = 0; column < row.length; column += 1) {
      if (row[column] !== '#') continue
      const longitude = -180 + (column + 0.5) * cell
      const x = (column + 0.5) * cell
      const y = (rowIndex + 0.5) * cell
      // One path with a circle per dot keeps the DOM to two nodes instead of ~2,000.
      const dot = `M${(x - radius).toFixed(2)} ${y.toFixed(2)}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
      ;(isDaylight(latitude, longitude, subsolar) ? day : night).push(dot)
    }
  })

  return { day: day.join(''), night: night.join('') }
}

/** SVG path data for the day/night boundary across the map. */
export function buildTerminatorPath(subsolar: GeoPoint, stepDegrees = 2): string {
  // At the equinoxes the curve degenerates to two meridians; a tiny tilt keeps it drawable.
  const declination =
    Math.abs(subsolar.latitude) < 0.1 ? (subsolar.latitude < 0 ? -0.1 : 0.1) : subsolar.latitude
  const tanDeclination = Math.tan(declination * RAD)
  const points: string[] = []
  for (let longitude = -180; longitude <= 180; longitude += stepDegrees) {
    const latitude = Math.atan(-Math.cos((longitude - subsolar.longitude) * RAD) / tanDeclination) / RAD
    const x = longitude + 180
    const y = WORLD_MAP_NORTH - latitude
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${points.join('L')}`
}

// ── Label placement ──────────────────────────────────────────

export interface MapLabelInput {
  id: string
  /** Marker position in pixels from the map's top-left corner. */
  x: number
  y: number
  width: number
  height: number
}

export type MapLabelSide = 'right' | 'left' | 'below' | 'above' | 'hidden'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/**
 * Greedily puts each label to the right of its marker, or failing that to the
 * left, below or above (centred), skipping spots that cover another marker,
 * collide with an earlier label or leave the map. Labels with no free spot are
 * hidden. Earlier entries win, so pass cities in priority order.
 */
export function layoutMapLabels(
  labels: ReadonlyArray<MapLabelInput>,
  mapWidth: number,
  mapHeight: number,
  gap = 6,
  markerRadius = 0,
): Record<string, MapLabelSide> {
  const sides: Record<string, MapLabelSide> = {}
  if (mapWidth <= 0 || mapHeight <= 0) {
    // Nothing measured yet (or no layout engine): keep every label visible.
    for (const label of labels) sides[label.id] = 'right'
    return sides
  }

  const markers: Box[] = labels.map((label) => ({
    left: label.x - markerRadius,
    right: label.x + markerRadius,
    top: label.y - markerRadius,
    bottom: label.y + markerRadius,
  }))
  const placed: Box[] = []
  for (const label of labels) {
    const top = label.y - label.height / 2
    const centredLeft = label.x - label.width / 2
    const candidates: Array<[MapLabelSide, Box]> = [
      ['right', { left: label.x + gap, right: label.x + gap + label.width, top, bottom: top + label.height }],
      ['left', { left: label.x - gap - label.width, right: label.x - gap, top, bottom: top + label.height }],
      [
        'below',
        { left: centredLeft, right: centredLeft + label.width, top: label.y + gap, bottom: label.y + gap + label.height },
      ],
      [
        'above',
        { left: centredLeft, right: centredLeft + label.width, top: label.y - gap - label.height, bottom: label.y - gap },
      ],
    ]
    const choice = candidates.find(
      ([, box]) =>
        box.left >= 0 &&
        box.right <= mapWidth &&
        box.top >= 0 &&
        box.bottom <= mapHeight &&
        !placed.some((other) => overlaps(box, other)) &&
        !markers.some((marker) => overlaps(box, marker)),
    )
    if (choice) {
      sides[label.id] = choice[0]
      placed.push(choice[1])
    } else {
      sides[label.id] = 'hidden'
    }
  }
  return sides
}
