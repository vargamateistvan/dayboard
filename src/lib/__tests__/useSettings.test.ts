import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  saveProfile,
  loadProfile,
  applyProfile,
  applyPreset,
  deleteProfile,
  listProfiles,
  renameProfile,
  exportProfile,
  importProfile,
  getActiveScheduledPreset,
  isPresetScheduledNow,
  savePreset,
  encryptSettings,
  decryptSettings,
  isEncrypted,
  saveEncryptedSettings,
  loadEncryptedSettings,
} from '../settings'
import { SettingsProvider, useSettings } from '../useSettings'
import { loadWidgetLayoutState } from '../useWidgetVisibility'

function SettingsProbe() {
  const { settings } = useSettings()
  return React.createElement('div', { 'data-testid': 'theme-value' }, settings.theme)
}

function SettingsManualOverrideProbe() {
  const { settings, updateSettings } = useSettings()
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('div', { 'data-testid': 'theme-value' }, settings.theme),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => updateSettings({ theme: 'retro' }),
      },
      'Set manual theme',
    ),
  )
}

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
    expect(loaded.calendarExtraInfoPreview).toBe(DEFAULT_SETTINGS.calendarExtraInfoPreview)
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
      globalCalendarFeeds: [],
      calendarHidePastEvents: true,
      calendarShowMonthlyOverview: false,
      calendarExtraInfoPreview: 'weekly' as const,
      calendarShowAllDayEvents: false,
      calendarWeekStartsOn: 'sunday' as const,
      weatherRefreshMinutes: 15,
      weatherUnitSystem: 'imperial' as const,
      weatherShowExtraDetails: false,
      flightsRadiusKm: 40,
      flightsRadarRadiusKm: 25,
      flightsRefreshSeconds: 90,
      flightsShowLabels: false,
      flightsShowOnlyAirborne: false,
      flightsUseDeviceLocation: false,
      flightsManualLatitude: '47.4979',
      flightsManualLongitude: '19.0402',
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
      sportsFavoriteTeams: [],
      sportsEnabledLeagues: [...DEFAULT_SETTINGS.sportsEnabledLeagues],
      sportsRefreshMinutes: 15,
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
        calendarExtraInfoPreview: 'yearly',
        calendarShowAllDayEvents: 'yes',
        calendarWeekStartsOn: 'friday',
        weatherUnitSystem: 'kelvin',
        weatherShowExtraDetails: 'nope',
        flightsRadiusKm: 1,
        flightsRadarRadiusKm: 999,
        flightsRefreshSeconds: 1,
        flightsShowLabels: 'yes',
        flightsShowOnlyAirborne: 'sometimes',
        flightsUseDeviceLocation: 'no',
        flightsManualLatitude: 47.5,
        flightsManualLongitude: 19.0,
        showBuyMeACoffeeWidget: 'sometimes',
        worldClockCity: 123,
        worldClockTimeZone: 'Mars/Phobos',
        sportsFavoriteTeams: 'arsenal',
        sportsEnabledLeagues: [],
        sportsRefreshMinutes: 0,
      }),
    )
    const loaded = loadSettings()
    expect(loaded.weatherUnitSystem).toBe(DEFAULT_SETTINGS.weatherUnitSystem)
    expect(loaded.weatherShowExtraDetails).toBe(DEFAULT_SETTINGS.weatherShowExtraDetails)
    expect(loaded.flightsRadiusKm).toBe(5)
    expect(loaded.flightsRadarRadiusKm).toBe(250)
    expect(loaded.flightsRefreshSeconds).toBe(2)
    expect(loaded.flightsShowLabels).toBe(DEFAULT_SETTINGS.flightsShowLabels)
    expect(loaded.flightsShowOnlyAirborne).toBe(DEFAULT_SETTINGS.flightsShowOnlyAirborne)
    expect(loaded.flightsUseDeviceLocation).toBe(DEFAULT_SETTINGS.flightsUseDeviceLocation)
    expect(loaded.flightsManualLatitude).toBe(DEFAULT_SETTINGS.flightsManualLatitude)
    expect(loaded.flightsManualLongitude).toBe(DEFAULT_SETTINGS.flightsManualLongitude)
    expect(loaded.showBuyMeACoffeeWidget).toBe(DEFAULT_SETTINGS.showBuyMeACoffeeWidget)
    expect(loaded.calendarHidePastEvents).toBe(DEFAULT_SETTINGS.calendarHidePastEvents)
    expect(loaded.calendarShowMonthlyOverview).toBe(DEFAULT_SETTINGS.calendarShowMonthlyOverview)
    expect(loaded.calendarExtraInfoPreview).toBe(DEFAULT_SETTINGS.calendarExtraInfoPreview)
    expect(loaded.calendarShowAllDayEvents).toBe(DEFAULT_SETTINGS.calendarShowAllDayEvents)
    expect(loaded.calendarWeekStartsOn).toBe(DEFAULT_SETTINGS.calendarWeekStartsOn)
    expect(loaded.worldClockCity).toBe(DEFAULT_SETTINGS.worldClockCity)
    expect(loaded.worldClockTimeZone).toBe(DEFAULT_SETTINGS.worldClockTimeZone)
    expect(loaded.sportsFavoriteTeams).toEqual(DEFAULT_SETTINGS.sportsFavoriteTeams)
    expect(loaded.sportsEnabledLeagues).toEqual(DEFAULT_SETTINGS.sportsEnabledLeagues)
    expect(loaded.sportsRefreshMinutes).toBe(1)
  })

  it('migrates the legacy 25 km flights radius to the new 50 km default', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ flightsRadiusKm: 25 }))

    expect(loadSettings().flightsRadiusKm).toBe(DEFAULT_SETTINGS.flightsRadiusKm)
  })

  it('uses the radar range default when no flights radar radius is saved', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ flightsRadiusKm: 50 }))

    expect(loadSettings().flightsRadarRadiusKm).toBe(DEFAULT_SETTINGS.flightsRadarRadiusKm)
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

describe('settings profiles', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('saves and loads a profile', () => {
    const settings = { ...DEFAULT_SETTINGS, theme: 'ocean' as const }
    saveProfile('ocean-theme', settings)

    const loaded = loadProfile('ocean-theme')
    expect(loaded).not.toBeNull()
    expect(loaded?.theme).toBe('ocean')
  })

  it('lists all saved profiles', () => {
    saveProfile('profile1', DEFAULT_SETTINGS)
    saveProfile('profile2', { ...DEFAULT_SETTINGS, theme: 'nature' as const })

    const profiles = listProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.map(p => p.name)).toContain('profile1')
    expect(profiles.map(p => p.name)).toContain('profile2')
  })

  it('applies a profile', () => {
    const settings = { ...DEFAULT_SETTINGS, theme: 'nature' as const }
    saveProfile('nature-theme', settings)
    applyProfile('nature-theme')

    const loaded = loadSettings()
    expect(loaded.theme).toBe('nature')
  })

  it('applies a preset layout together with settings', () => {
    savePreset(
      'layout-preset',
      { ...DEFAULT_SETTINGS, theme: 'retro' as const },
      undefined,
      {
        rowCount: 4,
        visibility: {
          ...loadWidgetLayoutState().visibility,
          tasks: true,
        },
        placements: loadWidgetLayoutState().placements,
      },
    )

    applyPreset('layout-preset')

    expect(loadSettings().theme).toBe('retro')
    expect(loadWidgetLayoutState()).toMatchObject({
      rowCount: 4,
      visibility: {
        tasks: true,
      },
    })
  })

  it('deletes a profile', () => {
    saveProfile('temp-profile', DEFAULT_SETTINGS)
    expect(listProfiles()).toHaveLength(1)

    deleteProfile('temp-profile')
    expect(listProfiles()).toHaveLength(0)
    expect(loadProfile('temp-profile')).toBeNull()
  })

  it('renames a profile', () => {
    saveProfile('old-name', DEFAULT_SETTINGS)
    renameProfile('old-name', 'new-name')

    expect(loadProfile('old-name')).toBeNull()
    expect(loadProfile('new-name')).not.toBeNull()
  })

  it('exports a profile as JSON', () => {
    const settings = { ...DEFAULT_SETTINGS, theme: 'retro' as const }
    saveProfile('retro-theme', settings)

    const exported = exportProfile('retro-theme', false)
    const parsed = JSON.parse(exported)
    expect(parsed.settings.theme).toBe('retro')
  })

  it('imports a profile from JSON', () => {
    const settings = { ...DEFAULT_SETTINGS, theme: 'sunset' as const }
    const json = JSON.stringify({ settings })

    const success = importProfile('imported-theme', json)
    expect(success).toBe(true)
    expect(loadProfile('imported-theme')?.theme).toBe('sunset')
  })

  it('rejects invalid profile during import', () => {
    const invalid = JSON.stringify({ settings: { invalid: true } })
    const success = importProfile('bad-profile', invalid)
    expect(success).toBe(false)
  })

  it('returns the scheduled preset that matches the current time', () => {
    savePreset(
      'work',
      { ...DEFAULT_SETTINGS, theme: 'nature' as const },
      { enabled: true, startTime: '09:00', endTime: '17:00' },
    )

    const activePreset = getActiveScheduledPreset(new Date('2026-08-10T10:30:00'))
    expect(activePreset?.name).toBe('work')
    expect(activePreset?.settings.theme).toBe('nature')
  })

  it('supports overnight preset schedules', () => {
    expect(
      isPresetScheduledNow(
        { enabled: true, startTime: '22:00', endTime: '06:00' },
        new Date('2026-08-10T23:30:00'),
      ),
    ).toBe(true)

    expect(
      isPresetScheduledNow(
        { enabled: true, startTime: '22:00', endTime: '06:00' },
        new Date('2026-08-10T12:00:00'),
      ),
    ).toBe(false)
  })

  it('auto-applies the active scheduled preset in the settings provider', async () => {
    saveSettings(DEFAULT_SETTINGS)
    savePreset(
      'focus-hours',
      { ...DEFAULT_SETTINGS, theme: 'ocean' as const },
      { enabled: true, startTime: '00:00', endTime: '23:59' },
    )

    render(
      React.createElement(
        SettingsProvider,
        null,
        React.createElement(SettingsProbe),
      ),
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('ocean')
    })
  })

  it('does not re-apply an active scheduled preset after a manual theme change', async () => {
    saveSettings(DEFAULT_SETTINGS)
    savePreset(
      'focus-hours',
      { ...DEFAULT_SETTINGS, theme: 'ocean' as const },
      { enabled: true, startTime: '00:00', endTime: '23:59' },
    )

    render(
      React.createElement(
        SettingsProvider,
        null,
        React.createElement(SettingsManualOverrideProbe),
      ),
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('ocean')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Set manual theme' }))
    expect(screen.getByTestId('theme-value')).toHaveTextContent('retro')

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new CustomEvent('settingsPresetsChanged'))

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('retro')
    })
  })
})

describe('settings encryption', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('encrypts settings', () => {
    const encrypted = encryptSettings(DEFAULT_SETTINGS, 'password123')
    expect(encrypted.encrypted).toBeTruthy()
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.version).toBe(1)
    expect(isEncrypted(encrypted)).toBe(true)
  })

  it('decrypts settings with correct password', () => {
    const encrypted = encryptSettings(DEFAULT_SETTINGS, 'password123')
    const decrypted = decryptSettings(encrypted, 'password123')

    expect(decrypted).not.toBeNull()
    expect(decrypted?.theme).toBe(DEFAULT_SETTINGS.theme)
  })

  it('fails to decrypt with wrong password', () => {
    const encrypted = encryptSettings(DEFAULT_SETTINGS, 'password123')
    const decrypted = decryptSettings(encrypted, 'wrongpassword')

    expect(decrypted).toBeNull()
  })

  it('rejects short passwords', () => {
    expect(() => encryptSettings(DEFAULT_SETTINGS, 'short')).toThrow()
  })

  it('saves and loads encrypted settings', () => {
    saveEncryptedSettings(DEFAULT_SETTINGS, 'password123')
    const loaded = loadEncryptedSettings('password123')

    expect(loaded).not.toBeNull()
    expect(loaded?.theme).toBe(DEFAULT_SETTINGS.theme)
  })

  it('fails to load with wrong password', () => {
    saveEncryptedSettings(DEFAULT_SETTINGS, 'password123')
    const loaded = loadEncryptedSettings('wrongpassword')

    expect(loaded).toBeNull()
  })

  it('detects encrypted data correctly', () => {
    const encrypted = encryptSettings(DEFAULT_SETTINGS, 'password123')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(isEncrypted(DEFAULT_SETTINGS)).toBe(false)
    expect(isEncrypted({ encrypted: 'x' })).toBe(false)
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
