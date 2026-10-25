import { afterEach, describe, expect, it } from 'vitest'
import { applyPreset, DEFAULT_SETTINGS, savePreset, SETTINGS_STORAGE_KEY } from '../settings'
import {
  DEFAULT_WORLD_CLOCK_CITY_IDS,
  migrateWorldClockCities,
  normalizeWorldClockCityIds,
  WORLD_CLOCK_CITIES_STORAGE_KEY,
} from '../worldClockStorage'

function storeSettings(value: Record<string, unknown>) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value))
}

function storedCities(): unknown {
  const raw = localStorage.getItem(WORLD_CLOCK_CITIES_STORAGE_KEY)
  return raw === null ? null : JSON.parse(raw)
}

describe('normalizeWorldClockCityIds', () => {
  it('drops unknown and duplicate city ids, keeping the order', () => {
    expect(normalizeWorldClockCityIds(['paris', 'atlantis', 7, 'paris', 'tokyo'])).toEqual(['paris', 'tokyo'])
  })

  it('keeps an emptied list empty and rejects anything that is not a list', () => {
    expect(normalizeWorldClockCityIds([])).toEqual([])
    expect(normalizeWorldClockCityIds('paris')).toBeNull()
    expect(normalizeWorldClockCityIds(null)).toBeNull()
  })
})

describe('migrateWorldClockCities', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('moves a city list saved in settings to its own key', () => {
    storeSettings({ worldClockCities: ['paris', 'atlantis', 'tokyo'] })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(['paris', 'tokyo'])
  })

  it('keeps an emptied list empty', () => {
    storeSettings({ worldClockCities: [] })
    migrateWorldClockCities()
    expect(storedCities()).toEqual([])
  })

  it('migrates the single-city world clock, keeping its city first', () => {
    storeSettings({ worldClockCity: 'Budapest', worldClockTimeZone: 'Europe/Budapest' })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(['budapest', ...DEFAULT_WORLD_CLOCK_CITY_IDS])
  })

  it('finds a single legacy city by name within its time zone, without duplicating defaults', () => {
    storeSettings({ worldClockCity: 'Boston', worldClockTimeZone: 'America/New_York' })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(['boston', ...DEFAULT_WORLD_CLOCK_CITY_IDS])

    localStorage.clear()
    storeSettings({ worldClockCity: 'New York', worldClockTimeZone: 'America/New_York' })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(DEFAULT_WORLD_CLOCK_CITY_IDS)
  })

  it('falls back to the defaults for a legacy time zone with no known city', () => {
    storeSettings({ worldClockTimeZone: 'Mars/Phobos' })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(DEFAULT_WORLD_CLOCK_CITY_IDS)
  })

  it('never overwrites a list the widget already saved', () => {
    localStorage.setItem(WORLD_CLOCK_CITIES_STORAGE_KEY, JSON.stringify(['sydney']))
    storeSettings({ worldClockCities: ['paris'] })
    migrateWorldClockCities()
    expect(storedCities()).toEqual(['sydney'])
  })

  it('writes nothing for new users or unreadable settings', () => {
    migrateWorldClockCities()
    expect(storedCities()).toBeNull()

    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json')
    migrateWorldClockCities()
    expect(storedCities()).toBeNull()

    storeSettings({ theme: 'ocean' })
    migrateWorldClockCities()
    expect(storedCities()).toBeNull()
  })
})

describe('world clock cities and presets', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('keeps the cities when a preset is applied, even one saved before they were added', () => {
    savePreset('Work', { ...DEFAULT_SETTINGS, colorScheme: 'dark' })
    localStorage.setItem(WORLD_CLOCK_CITIES_STORAGE_KEY, JSON.stringify(['paris', 'tokyo']))

    applyPreset('Work')

    expect(storedCities()).toEqual(['paris', 'tokyo'])
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).not.toHaveProperty('worldClockCities')
  })
})
