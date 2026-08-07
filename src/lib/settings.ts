export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature' | 'ocean' | 'sunset'

export interface Settings {
  theme: Theme
  colorScheme: ColorScheme
  calendarUrls: string[]
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  colorScheme: 'system',
  calendarUrls: [],
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
}

const STORAGE_KEY = 'dayboard:settings'

interface StoredSettings extends Partial<Omit<Settings, 'calendarUrls'>> {
  calendarUrl?: unknown
  calendarUrls?: unknown
}

function normalizeCalendarUrls(calendarUrls: unknown, legacyCalendarUrl?: unknown): string[] {
  const candidateUrls = Array.isArray(calendarUrls)
    ? calendarUrls
    : typeof legacyCalendarUrl === 'string'
      ? [legacyCalendarUrl]
      : []

  return [...new Set(
    candidateUrls
      .filter((calendarUrl): calendarUrl is string => typeof calendarUrl === 'string')
      .map((calendarUrl) => calendarUrl.trim())
      .filter(Boolean),
  )]
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as StoredSettings
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      calendarUrls: normalizeCalendarUrls(parsed.calendarUrls, parsed.calendarUrl),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...settings,
      calendarUrls: normalizeCalendarUrls(settings.calendarUrls),
    }),
  )
}

export function resolveColorScheme(scheme: ColorScheme): 'light' | 'dark' {
  if (scheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return scheme
}

export function applyTheme(settings: Settings): void {
  const resolved = resolveColorScheme(settings.colorScheme)
  document.documentElement.setAttribute('data-theme', settings.theme)
  document.documentElement.setAttribute('data-color-scheme', resolved)
}
