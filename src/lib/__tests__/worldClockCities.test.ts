import { describe, expect, it } from 'vitest'
import {
  findWorldClockCityByTimeZone,
  getWorldClockCity,
  searchWorldClockCities,
  WORLD_CLOCK_CITIES,
} from '../worldClockCities'

describe('world clock cities', () => {
  it('has unique ids, valid time zones and coordinates on the globe', () => {
    expect(new Set(WORLD_CLOCK_CITIES.map((city) => city.id)).size).toBe(WORLD_CLOCK_CITIES.length)
    for (const city of WORLD_CLOCK_CITIES) {
      expect(() => new Intl.DateTimeFormat(undefined, { timeZone: city.timeZone }), city.id).not.toThrow()
      expect(Math.abs(city.latitude), city.id).toBeLessThanOrEqual(90)
      expect(Math.abs(city.longitude), city.id).toBeLessThanOrEqual(180)
    }
  })

  it('looks cities up by id and time zone', () => {
    expect(getWorldClockCity('tokyo')?.name).toBe('Tokyo')
    expect(getWorldClockCity('atlantis')).toBeUndefined()
    expect(findWorldClockCityByTimeZone('Europe/Budapest')?.id).toBe('budapest')
    expect(findWorldClockCityByTimeZone('Mars/Phobos')).toBeUndefined()
  })

  it('prefers the named city, then the city a zone is named after', () => {
    expect(findWorldClockCityByTimeZone('America/New_York')?.id).toBe('new-york')
    expect(findWorldClockCityByTimeZone('America/New_York', 'boston')?.id).toBe('boston')
    expect(findWorldClockCityByTimeZone('America/New_York', 'Gotham')?.id).toBe('new-york')
    expect(findWorldClockCityByTimeZone('Asia/Kolkata')?.timeZone).toBe('Asia/Kolkata')
  })

  it('searches names, countries and zones, ignoring accents and case', () => {
    expect(searchWorldClockCities('sao').map((city) => city.id)).toContain('sao-paulo')
    expect(searchWorldClockCities('JAPAN').map((city) => city.id)).toEqual(['osaka', 'tokyo'])
    expect(searchWorldClockCities('kolkata').map((city) => city.id)).toEqual(['bengaluru', 'mumbai', 'new-delhi'])
    expect(searchWorldClockCities('zzz')).toEqual([])
  })

  it('matches the start of words, not arbitrary substrings', () => {
    const ids = searchWorldClockCities('to').map((city) => city.id)
    expect(ids.slice(0, 2)).toEqual(['tokyo', 'toronto'])
    expect(ids).toContain('cape-town')
    // America/Toronto and Asia/Tokyo zones match too.
    expect(ids).toContain('montreal')
    expect(ids).toContain('osaka')
    expect(ids).not.toContain('boston')
    expect(ids).not.toContain('calgary')
    expect(searchWorldClockCities('york')[0].id).toBe('new-york')
    expect(searchWorldClockCities('new y').map((city) => city.id)).toEqual(['new-york'])
  })

  it('ranks cities whose name starts with the query first', () => {
    expect(searchWorldClockCities('par')[0].id).toBe('paris')
    expect(searchWorldClockCities('')).toHaveLength(WORLD_CLOCK_CITIES.length)
  })
})
