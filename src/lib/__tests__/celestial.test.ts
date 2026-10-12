import { describe, expect, it } from 'vitest'
import { getMoonPosition, getSunPosition } from '../celestial'

// Reference values from the NOAA solar calculator.
describe('getSunPosition', () => {
  it('matches a London summer solstice noon', () => {
    const { altitude, azimuth } = getSunPosition(new Date('2026-06-21T12:00:00Z'), 51.5074, -0.1278)
    expect(altitude).toBeCloseTo(61.9, 0)
    expect(azimuth).toBeGreaterThan(170)
    expect(azimuth).toBeLessThan(190)
  })

  it('peaks low in a London winter, not at 90°', () => {
    const { altitude } = getSunPosition(new Date('2026-12-21T12:00:00Z'), 51.5074, -0.1278)
    expect(altitude).toBeCloseTo(15, 0)
  })

  it('is due north at noon in the southern hemisphere', () => {
    // Sydney local noon is about 02:00 UTC in June.
    const { azimuth, altitude } = getSunPosition(new Date('2026-06-21T02:00:00Z'), -33.8688, 151.2093)
    expect(altitude).toBeGreaterThan(25)
    expect(Math.min(azimuth, 360 - azimuth)).toBeLessThan(15)
  })

  it('stays below the horizon all day in polar night', () => {
    const date = new Date('2026-12-21T00:00:00Z')
    for (let hour = 0; hour < 24; hour += 1) {
      const instant = new Date(date.getTime() + hour * 3_600_000)
      expect(getSunPosition(instant, 78.22, 15.65).altitude).toBeLessThan(0)
    }
  })

  it('rises in the east and sets in the west', () => {
    // Budapest, morning and evening around the equinox.
    expect(getSunPosition(new Date('2026-03-20T05:00:00Z'), 47.5, 19.04).azimuth).toBeCloseTo(90, -1)
    expect(getSunPosition(new Date('2026-03-20T17:00:00Z'), 47.5, 19.04).azimuth).toBeCloseTo(270, -1)
  })
})

describe('getMoonPosition', () => {
  it('returns plausible values', () => {
    const { altitude, azimuth } = getMoonPosition(new Date('2026-10-12T20:00:00Z'), 47.5, 19.04)
    expect(altitude).toBeGreaterThanOrEqual(-90)
    expect(altitude).toBeLessThanOrEqual(90)
    expect(azimuth).toBeGreaterThanOrEqual(0)
    expect(azimuth).toBeLessThan(360)
  })

  it('moves roughly 13° a day against the stars', () => {
    // Same sidereal time each day, so the change comes from the moon's motion.
    const first = getMoonPosition(new Date('2026-10-12T00:00:00Z'), 0, 0)
    const second = getMoonPosition(new Date('2026-10-12T23:56:04Z'), 0, 0)
    const shift = Math.abs(first.azimuth - second.azimuth) + Math.abs(first.altitude - second.altitude)
    expect(shift).toBeGreaterThan(5)
    expect(shift).toBeLessThan(40)
  })
})
