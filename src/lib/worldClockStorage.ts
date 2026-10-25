import { readStorage, writeJson } from './storage'
import { SETTINGS_STORAGE_KEY } from './settings'
import { findWorldClockCityByTimeZone, getWorldClockCity } from './worldClockCities'

// The city list is content the user edits on the widget, like notes or tasks,
// so it lives under its own key instead of in settings: applying or switching
// a preset never replaces it, and adding a city doesn't unmatch the preset.
export const WORLD_CLOCK_CITIES_STORAGE_KEY = 'dayboard:world-clock-cities'

export const DEFAULT_WORLD_CLOCK_CITY_IDS: ReadonlyArray<string> = ['new-york', 'london', 'tokyo']

/** Known city ids in order, without duplicates; null when `value` isn't a list. */
export function normalizeWorldClockCityIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && getWorldClockCity(id) !== undefined))]
}

function readStoredSettings(): Record<string, unknown> | null {
  const raw = readStorage(SETTINGS_STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Moves cities saved by earlier versions out of the settings object: first a
 * `worldClockCities` list, and before that a single city picked by time zone.
 * Runs before the app renders, because the next settings save drops those
 * fields. Does nothing once the widget has a list of its own.
 */
export function migrateWorldClockCities(): void {
  if (readStorage(WORLD_CLOCK_CITIES_STORAGE_KEY) !== null) {
    return
  }

  const stored = readStoredSettings()
  if (!stored) {
    return
  }

  const list = normalizeWorldClockCityIds(stored.worldClockCities)
  if (list) {
    writeJson(WORLD_CLOCK_CITIES_STORAGE_KEY, list)
    return
  }

  if (typeof stored.worldClockTimeZone === 'string') {
    const legacyCity = findWorldClockCityByTimeZone(
      stored.worldClockTimeZone.trim(),
      typeof stored.worldClockCity === 'string' ? stored.worldClockCity : undefined,
    )
    // Keep the city they chose first, followed by the usual defaults.
    writeJson(WORLD_CLOCK_CITIES_STORAGE_KEY, [
      ...new Set([...(legacyCity ? [legacyCity.id] : []), ...DEFAULT_WORLD_CLOCK_CITY_IDS]),
    ])
  }
}
