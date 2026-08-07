import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadSettings, saveSettings, resolveColorScheme, DEFAULT_SETTINGS } from '../settings'

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
  })

  it('returns defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('dayboard:settings', 'not-json{{{')
    const loaded = loadSettings()
    expect(loaded).toEqual(DEFAULT_SETTINGS)
  })

  it('migrates a legacy single calendarUrl setting into calendarUrls', () => {
    localStorage.setItem('dayboard:settings', JSON.stringify({ calendarUrl: 'https://example.com/cal.ics' }))
    expect(loadSettings().calendarUrls).toEqual(['https://example.com/cal.ics'])
  })

  it('round-trips all fields correctly', () => {
    const custom = {
      theme: 'futuristic' as const,
      colorScheme: 'dark' as const,
      calendarUrls: ['https://example.com/cal.ics', 'webcal://outlook.live.com/calendar/foo/bar/calendar.ics'],
      pomodoroWorkMinutes: 50,
      pomodoroBreakMinutes: 10,
    }
    saveSettings(custom)
    expect(loadSettings()).toEqual(custom)
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
