import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadSettings,
  saveSettings,
  resolveColorScheme,
  DEFAULT_SETTINGS,
  DEFAULT_CALENDAR_COLORS,
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
        title: 'Spotify Track',
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
      spotifyPodcastEmbedUrl: 'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk',
      spotifyPodcastEmbedLinks: [
        {
          url: 'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk',
          title: 'The Joe Rogan Experience',
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
      customColors: DEFAULT_SETTINGS.customColors,
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
