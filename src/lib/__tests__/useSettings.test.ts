import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadSettings,
  saveSettings,
  resolveColorScheme,
  DEFAULT_SETTINGS,
  DEFAULT_CALENDAR_COLORS,
  validateSettings,
  resetSettings,
  exportSettings,
  importSettings,
  getSettingsDiff,
  isValidSettings,
} from '../settings'

describe('settings persistence', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns defaults when localStorage is empty', () => {
    const s = loadSettings()
    expect(s).toEqual(DEFAULT_SETTINGS)
  })

  it('persists and reads back a saved value', () => {
    const updated = { ...DEFAULT_SETTINGS, theme: 'retro' as const }
    saveSettings(updated)
    const loaded = loadSettings()
    expect(loaded.theme).toBe('retro')
  })

  it('merges missing keys with defaults after partial save', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ theme: 'nature' }))
    const loaded = loadSettings()
    expect(loaded.theme).toBe('nature')
    expect(loaded.pomodoroWorkMinutes).toBe(DEFAULT_SETTINGS.pomodoroWorkMinutes)
    expect(loaded.weatherRefreshMinutes).toBe(DEFAULT_SETTINGS.weatherRefreshMinutes)
    expect(loaded.showBuyMeACoffeeWidget).toBe(DEFAULT_SETTINGS.showBuyMeACoffeeWidget)
    expect(loaded.calendarHidePastEvents).toBe(DEFAULT_SETTINGS.calendarHidePastEvents)
    expect(loaded.calendarShowMonthlyOverview).toBe(DEFAULT_SETTINGS.calendarShowMonthlyOverview)
    expect(loaded.calendarShowAllDayEvents).toBe(DEFAULT_SETTINGS.calendarShowAllDayEvents)
    expect(loaded.calendarWeekStartsOn).toBe(DEFAULT_SETTINGS.calendarWeekStartsOn)
  })

  it('returns defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('dayboard:settings', 'not-json{{{')
    const loaded = loadSettings()
    expect(loaded).toEqual(DEFAULT_SETTINGS)
  })

  it('migrates a legacy single calendarUrl setting into calendarFeeds', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ calendarUrl: 'https://example.com/cal.ics' }))
    expect(loadSettings().calendarFeeds).toEqual([
      { url: 'https://example.com/cal.ics', color: DEFAULT_CALENDAR_COLORS[0] },
    ])
  })

  it('migrates legacy single media links into saved link lists', () => {
    localStorage.setItem(
      'dayboard:settings',
      JSON.stringify({
        spotifyEmbedUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        appleMusicEmbedUrl: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475',
      }),
    )
    const loaded = loadSettings()
    expect(loaded.spotifyEmbedLinks).toEqual([
      {
        url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        title: 'Track',
      },
    ])
    expect(loaded.appleMusicEmbedLinks).toEqual([
      {
        url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475',
        title: 'Apple Music 1989',
      },
    ])
  })

  it('round-trips all fields correctly', () => {
    const custom = {
      theme: 'futuristic' as const,
      colorScheme: 'dark' as const,
      fontPreset: 'orbitron' as const,
      showBuyMeACoffeeWidget: false,
      calendarFeeds: [
        { url: 'https://example.com/cal.ics', color: '#123456' },
        { url: 'webcal://outlook.live.com/calendar/foo/bar/calendar.ics', color: '#654321' },
      ],
      calendarHidePastEvents: true,
      calendarShowMonthlyOverview: false,
      calendarShowAllDayEvents: false,
      calendarWeekStartsOn: 'sunday' as const,
      weatherRefreshMinutes: 15,
      weatherUnitSystem: 'imperial' as const,
      weatherShowExtraDetails: false,
      spotifyEmbedUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      spotifyEmbedLinks: [
        {
          url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          title: 'Never Gonna Give You Up',
        },
        {
          url: 'https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX',
          title: 'Evermore',
        },
      ],
      appleMusicEmbedUrl: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475',
      appleMusicEmbedLinks: [
        {
          url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475',
          title: '1989',
        },
      ],
      applePodcastEmbedUrl: 'https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272',
      applePodcastEmbedLinks: [
        {
          url: 'https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272',
          title: 'The Joe Rogan Experience',
        },
      ],
      pomodoroWorkMinutes: 50,
      pomodoroBreakMinutes: 10,
      stockSymbols: ['AAPL', 'TSLA'],
      currencyPairs: [['USD', 'EUR'], ['GBP', 'JPY']] as [string, string][],
      financeRefreshMinutes: 5,
      worldClockCity: 'Tokyo',
      worldClockTimeZone: 'Asia/Tokyo',
      customColors: {
        primary: DEFAULT_SETTINGS.customColors!.primary,
        primaryHover: DEFAULT_SETTINGS.customColors!.primaryHover,
        background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
        fontColor: DEFAULT_SETTINGS.customColors!.fontColor,
        secondaryFontColor: DEFAULT_SETTINGS.customColors!.secondaryFontColor,
      },
    }
    saveSettings(custom)
    expect(loadSettings()).toEqual(custom)
  })

  it('falls back to default font preset when saved value is invalid', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ fontPreset: 'not-a-font' }))
    expect(loadSettings().fontPreset).toBe(DEFAULT_SETTINGS.fontPreset)
  })

  it('falls back to default weather refresh minutes when saved value is invalid', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ weatherRefreshMinutes: 'fast' }))
    expect(loadSettings().weatherRefreshMinutes).toBe(DEFAULT_SETTINGS.weatherRefreshMinutes)
  })

  it('falls back to default weather preferences when saved values are invalid', () => {
    localStorage.setItem(
      'dayboard:settings',
      JSON.stringify({
        calendarHidePastEvents: 'no',
        calendarShowMonthlyOverview: 'sometimes',
        calendarShowAllDayEvents: 'yes',
        calendarWeekStartsOn: 'friday',
        weatherUnitSystem: 'kelvin',
        weatherShowExtraDetails: 'nope',
        showBuyMeACoffeeWidget: 'sometimes',
        worldClockCity: 123,
        worldClockTimeZone: 'Mars/Phobos',
      }),
    )
    const loaded = loadSettings()
    expect(loaded.weatherUnitSystem).toBe(DEFAULT_SETTINGS.weatherUnitSystem)
    expect(loaded.weatherShowExtraDetails).toBe(DEFAULT_SETTINGS.weatherShowExtraDetails)
    expect(loaded.showBuyMeACoffeeWidget).toBe(DEFAULT_SETTINGS.showBuyMeACoffeeWidget)
    expect(loaded.calendarHidePastEvents).toBe(DEFAULT_SETTINGS.calendarHidePastEvents)
    expect(loaded.calendarShowMonthlyOverview).toBe(DEFAULT_SETTINGS.calendarShowMonthlyOverview)
    expect(loaded.calendarShowAllDayEvents).toBe(DEFAULT_SETTINGS.calendarShowAllDayEvents)
    expect(loaded.calendarWeekStartsOn).toBe(DEFAULT_SETTINGS.calendarWeekStartsOn)
    expect(loaded.worldClockCity).toBe(DEFAULT_SETTINGS.worldClockCity)
    expect(loaded.worldClockTimeZone).toBe(DEFAULT_SETTINGS.worldClockTimeZone)
  })
})

describe('resolveColorScheme', () => {
  it('returns light when scheme is light', () => {
    expect(resolveColorScheme('light')).toBe('light')
  })

  it('returns dark when scheme is dark', () => {
    expect(resolveColorScheme('dark')).toBe('dark')
  })

  it('detects system dark preference', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    expect(resolveColorScheme('system')).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('detects system light preference', () => {
    vi.stubGlobal('matchMedia', (_query: string) => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    expect(resolveColorScheme('system')).toBe('light')
    vi.unstubAllGlobals()
  })
})

describe('settings validation', () => {
  it('validates correct settings', () => {
    const result = validateSettings(DEFAULT_SETTINGS)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('catches invalid theme', () => {
    const invalid = { ...DEFAULT_SETTINGS, theme: 'invalid' as unknown as typeof DEFAULT_SETTINGS.theme }
    const result = validateSettings(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('theme'))).toBe(true)
  })

  it('catches invalid pomodoro work minutes', () => {
    const invalid = { ...DEFAULT_SETTINGS, pomodoroWorkMinutes: 200 }
    const result = validateSettings(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('pomodoroWorkMinutes'))).toBe(true)
  })
})

describe('settings export/import', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('exports settings as JSON', () => {
    const custom = { ...DEFAULT_SETTINGS, theme: 'retro' as const }
    saveSettings(custom)

    const exported = exportSettings(false)
    const parsed = JSON.parse(exported)
    expect(parsed.theme).toBe('retro')
  })

  it('imports valid settings', () => {
    const custom = { ...DEFAULT_SETTINGS, theme: 'ocean' as const }
    const json = JSON.stringify(custom)

    const imported = importSettings(json)
    expect(imported).not.toBeNull()
    expect(imported?.theme).toBe('ocean')
  })

  it('rejects invalid settings during import', () => {
    const invalid = JSON.stringify({ ...DEFAULT_SETTINGS, pomodoroWorkMinutes: 500 })
    const imported = importSettings(invalid)
    expect(imported).toBeNull()
  })

  it('formats exported JSON with pretty printing', () => {
    const exported = exportSettings(true)
    expect(exported).toContain('\n')
    expect(exported).toContain('  ')
  })
})

describe('settings reset', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('resets all settings to defaults', () => {
    const custom = { ...DEFAULT_SETTINGS, theme: 'nature' as const }
    saveSettings(custom)
    resetSettings()
    expect(loadSettings().theme).toBe(DEFAULT_SETTINGS.theme)
  })
})

describe('settings diff', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('detects changes from defaults', () => {
    const custom = { ...DEFAULT_SETTINGS, theme: 'sunset' as const, pomodoroWorkMinutes: 30 }
    saveSettings(custom)

    const diff = getSettingsDiff()
    expect(diff.theme).toBe('sunset')
    expect(diff.pomodoroWorkMinutes).toBe(30)
  })

  it('returns empty diff when no changes', () => {
    saveSettings(DEFAULT_SETTINGS)
    const diff = getSettingsDiff()
    expect(Object.keys(diff)).toHaveLength(0)
  })
})

describe('type guards', () => {
  it('validates correct settings object', () => {
    expect(isValidSettings(DEFAULT_SETTINGS)).toBe(true)
  })

  it('rejects invalid settings object', () => {
    expect(isValidSettings({ theme: 'test' })).toBe(false)
    expect(isValidSettings(null)).toBe(false)
    expect(isValidSettings('string')).toBe(false)
  })
})

