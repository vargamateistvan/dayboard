import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CUSTOM_COLORS, DEFAULT_SETTINGS, loadSettings, validateSettings } from '../settings'

function loadStored(value: Record<string, unknown>) {
  localStorage.setItem('dayboard:settings', JSON.stringify(value))
  return loadSettings()
}

describe('stored settings validation', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('falls back for an unknown theme or color scheme', () => {
    const settings = loadStored({ theme: 'foo', colorScheme: 'neon' })
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(settings.colorScheme).toBe(DEFAULT_SETTINGS.colorScheme)
  })

  it('keeps valid theme and color scheme values', () => {
    const settings = loadStored({ theme: 'ocean', colorScheme: 'dark' })
    expect(settings.theme).toBe('ocean')
    expect(settings.colorScheme).toBe('dark')
  })

  it('rejects custom colors that could load remote resources', () => {
    const settings = loadStored({
      customColors: {
        primary: 'red; background: url(https://evil.example/track.png)',
        primaryHover: '#123456',
        background: 'url(https://evil.example/track.png)',
        fontColor: 'image-set("https://evil.example/x.png" 1x)',
        secondaryFontColor: '#999',
      },
    })

    expect(settings.customColors?.primary).toBe(DEFAULT_CUSTOM_COLORS.primary)
    expect(settings.customColors?.primaryHover).toBe('#123456')
    expect(settings.customColors?.background).toBe(DEFAULT_CUSTOM_COLORS.background)
    expect(settings.customColors?.fontColor).toBe(DEFAULT_CUSTOM_COLORS.fontColor)
  })

  it('keeps colors and gradients the settings UI produces', () => {
    const gradient = 'linear-gradient(135deg, #0f172a, #1e3a8a)'
    const settings = loadStored({
      customColors: { ...DEFAULT_CUSTOM_COLORS, primary: '#ff0000', background: gradient },
    })

    expect(settings.customColors?.primary).toBe('#ff0000')
    expect(settings.customColors?.background).toBe(gradient)
  })
})

describe('world clock cities', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('drops unknown and duplicate city ids', () => {
    const settings = loadStored({ worldClockCities: ['paris', 'atlantis', 7, 'paris', 'tokyo'] })
    expect(settings.worldClockCities).toEqual(['paris', 'tokyo'])
  })

  it('keeps an emptied list empty', () => {
    expect(loadStored({ worldClockCities: [] }).worldClockCities).toEqual([])
  })

  it('migrates the single-city world clock, keeping its city first', () => {
    const settings = loadStored({ worldClockCity: 'Budapest', worldClockTimeZone: 'Europe/Budapest' })
    expect(settings.worldClockCities).toEqual(['budapest', ...DEFAULT_SETTINGS.worldClockCities])
    expect(settings).not.toHaveProperty('worldClockCity')
    expect(settings).not.toHaveProperty('worldClockTimeZone')
  })

  it('does not duplicate a migrated city that is already a default', () => {
    const settings = loadStored({ worldClockCity: 'New York', worldClockTimeZone: 'America/New_York' })
    expect(settings.worldClockCities).toEqual(DEFAULT_SETTINGS.worldClockCities)
  })

  it('migrates a legacy city by name within its time zone', () => {
    const settings = loadStored({ worldClockCity: 'Boston', worldClockTimeZone: 'America/New_York' })
    expect(settings.worldClockCities[0]).toBe('boston')
  })

  it('falls back to the defaults for a legacy time zone with no known city', () => {
    expect(loadStored({ worldClockTimeZone: 'Mars/Phobos' }).worldClockCities).toEqual(
      DEFAULT_SETTINGS.worldClockCities,
    )
  })

  it('reports unknown city ids as invalid', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, worldClockCities: ['tokyo'] }).errors).not.toContain(
      'worldClockCities must be a list of known city ids',
    )
    expect(validateSettings({ ...DEFAULT_SETTINGS, worldClockCities: ['atlantis'] }).errors).toContain(
      'worldClockCities must be a list of known city ids',
    )
  })
})
