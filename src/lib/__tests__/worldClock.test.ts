import { describe, expect, it } from 'vitest'
import { getSubsolarPoint } from '../celestial'
import {
  buildMapDotPaths,
  buildTerminatorPath,
  formatHourOffset,
  formatRelativeDay,
  getRelativeDay,
  getSunTimes,
  getTimeZoneOffsetMinutes,
  getZonedTime,
  isDaylight,
  layoutMapLabels,
  projectToMap,
} from '../worldClock'
import { WORLD_MAP_ROWS } from '../worldMapDots'

function minutesOfDay(date: Date, timeZone: string): number {
  const zoned = getZonedTime(date, timeZone)
  return zoned.hour * 60 + zoned.minute
}

describe('time zone helpers', () => {
  it('reads wall-clock time in a zone', () => {
    expect(getZonedTime(new Date('2026-08-08T15:04:05Z'), 'Asia/Tokyo')).toEqual({
      year: 2026,
      month: 8,
      day: 9,
      hour: 0,
      minute: 4,
      second: 5,
    })
  })

  it('computes UTC offsets, including half hours and daylight saving', () => {
    const summer = new Date('2026-08-08T12:00:00Z')
    const winter = new Date('2026-01-15T12:00:00Z')
    expect(getTimeZoneOffsetMinutes(summer, 'Asia/Tokyo')).toBe(540)
    expect(getTimeZoneOffsetMinutes(summer, 'Asia/Kolkata')).toBe(330)
    expect(getTimeZoneOffsetMinutes(summer, 'America/New_York')).toBe(-240)
    expect(getTimeZoneOffsetMinutes(winter, 'America/New_York')).toBe(-300)
    expect(getTimeZoneOffsetMinutes(new Date('2026-08-08T12:00:00.999Z'), 'UTC')).toBe(0)
  })

  it('tells whether a zone is a day ahead or behind', () => {
    const date = new Date('2026-08-08T20:00:00Z')
    expect(getRelativeDay(date, 'Asia/Tokyo', 'America/New_York')).toBe(1)
    expect(getRelativeDay(date, 'America/New_York', 'Asia/Tokyo')).toBe(-1)
    expect(getRelativeDay(date, 'Europe/London', 'Europe/Paris')).toBe(0)
  })

  it('formats the relative day and hour offset like Apple', () => {
    expect(formatRelativeDay(0)).toBe('Today')
    expect(formatRelativeDay(1)).toBe('Tomorrow')
    expect(formatRelativeDay(-1)).toBe('Yesterday')
    expect(formatHourOffset(0)).toBe('+0 HRS')
    expect(formatHourOffset(60)).toBe('+1 HR')
    expect(formatHourOffset(-60)).toBe('-1 HR')
    expect(formatHourOffset(540)).toBe('+9 HRS')
    expect(formatHourOffset(-330)).toBe('-5:30 HRS')
    expect(formatHourOffset(345)).toBe('+5:45 HRS')
  })
})

describe('sun', () => {
  it('finds the subsolar point at the June solstice', () => {
    const point = getSubsolarPoint(new Date('2026-06-21T12:00:00Z'))
    expect(point.latitude).toBeCloseTo(23.44, 0)
    // The equation of time keeps it within a degree or so of Greenwich at UTC noon.
    expect(Math.abs(point.longitude)).toBeLessThan(1.5)
  })

  it('splits day from night', () => {
    const subsolar = getSubsolarPoint(new Date('2026-03-20T12:00:00Z'))
    expect(isDaylight(51.5, 0, subsolar)).toBe(true)
    expect(isDaylight(-35, 179, subsolar)).toBe(false)
  })

  it('finds sunrise and sunset in the city time zone', () => {
    // London on the summer solstice: sunrise 04:43, sunset 21:21 BST.
    const london = getSunTimes(new Date('2026-06-21T12:00:00Z'), 51.51, -0.13, 'Europe/London')
    expect(Math.abs(minutesOfDay(london.sunrise!, 'Europe/London') - (4 * 60 + 43))).toBeLessThanOrEqual(2)
    expect(Math.abs(minutesOfDay(london.sunset!, 'Europe/London') - (21 * 60 + 21))).toBeLessThanOrEqual(2)

    // Sydney in midwinter, queried late at night UTC (already the next day there): 07:00 and 16:54 AEST.
    const sydney = getSunTimes(new Date('2026-06-20T20:00:00Z'), -33.87, 151.21, 'Australia/Sydney')
    expect(getZonedTime(sydney.sunrise!, 'Australia/Sydney').day).toBe(21)
    expect(Math.abs(minutesOfDay(sydney.sunrise!, 'Australia/Sydney') - 7 * 60)).toBeLessThanOrEqual(2)
    expect(Math.abs(minutesOfDay(sydney.sunset!, 'Australia/Sydney') - (16 * 60 + 54))).toBeLessThanOrEqual(2)
  })

  it('reports no sunrise or sunset during polar day and night', () => {
    expect(getSunTimes(new Date('2026-06-21T12:00:00Z'), 69.65, 18.96, 'Europe/Oslo')).toEqual({
      sunrise: null,
      sunset: null,
    })
    expect(getSunTimes(new Date('2026-12-21T12:00:00Z'), 69.65, 18.96, 'Europe/Oslo')).toEqual({
      sunrise: null,
      sunset: null,
    })
  })
})

describe('map geometry', () => {
  it('projects coordinates onto the map', () => {
    expect(projectToMap(84, -180)).toEqual({ x: 0, y: 0 })
    expect(projectToMap(-60, 180)).toEqual({ x: 1, y: 1 })
    // Points beyond the map's latitude range stick to its edge.
    expect(projectToMap(-80, 0).y).toBe(1)
  })

  it('draws one dot per land cell, split between day and night', () => {
    const landCells = WORLD_MAP_ROWS.join('').split('').filter((cell) => cell === '#').length
    const { day, night } = buildMapDotPaths(getSubsolarPoint(new Date('2026-08-08T12:00:00Z')))
    const dayDots = day.match(/M/g)?.length ?? 0
    const nightDots = night.match(/M/g)?.length ?? 0
    expect(dayDots).toBeGreaterThan(0)
    expect(nightDots).toBeGreaterThan(0)
    expect(dayDots + nightDots).toBe(landCells)
  })

  it('draws the terminator across the whole map', () => {
    const path = buildTerminatorPath(getSubsolarPoint(new Date('2026-08-08T12:00:00Z')))
    expect(path.startsWith('M0.00 ')).toBe(true)
    expect(path.split('L')).toHaveLength(181)
    expect(path).not.toMatch(/NaN|Infinity/)
  })

  it('still draws the terminator at an equinox', () => {
    const path = buildTerminatorPath({ latitude: 0, longitude: 0 })
    expect(path).not.toMatch(/NaN|Infinity/)
  })
})

describe('layoutMapLabels', () => {
  const label = (id: string, x: number, y: number) => ({ id, x, y, width: 60, height: 20 })

  it('puts labels to the right when there is room', () => {
    expect(layoutMapLabels([label('a', 10, 50), label('b', 10, 100)], 400, 200)).toEqual({ a: 'right', b: 'right' })
  })

  it('moves a label that collides with an earlier one to the left', () => {
    expect(layoutMapLabels([label('a', 100, 100), label('b', 100, 112)], 400, 200)).toEqual({ a: 'right', b: 'left' })
  })

  it('falls back to below, then above, and hides labels with no free spot', () => {
    // The map is too narrow for side labels, so they stack under and over the marker.
    const sides = layoutMapLabels([label('a', 35, 100), label('b', 35, 100), label('c', 35, 100)], 70, 200)
    expect(sides).toEqual({ a: 'below', b: 'above', c: 'hidden' })
  })

  it('keeps labels off other cities\' markers', () => {
    // b's marker sits where a's right-hand label would go.
    expect(layoutMapLabels([label('a', 100, 100), label('b', 130, 100)], 400, 200, 6, 4)).toEqual({
      a: 'left',
      b: 'right',
    })
  })

  it('keeps labels inside the map vertically', () => {
    expect(layoutMapLabels([label('a', 100, 2)], 400, 200)).toEqual({ a: 'below' })
  })

  it('flips labels that would run off the right edge', () => {
    expect(layoutMapLabels([label('a', 380, 50)], 400, 200)).toEqual({ a: 'left' })
  })

  it('shows every label before the map has been measured', () => {
    expect(layoutMapLabels([label('a', 0, 0), label('b', 0, 0)], 0, 0)).toEqual({ a: 'right', b: 'right' })
  })
})
