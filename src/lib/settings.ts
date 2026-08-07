export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature'

export interface Settings {
  theme: Theme
  colorScheme: ColorScheme
  calendarUrl: string
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  colorScheme: 'system',
  calendarUrl: '',
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
}

const STORAGE_KEY = 'dayboard:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
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
