export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature' | 'ocean' | 'sunset' | 'custom'
export type FontPreset = 'space-grotesk' | 'jetbrains-mono' | 'geist-mono' | 'pixelify-sans' | 'orbitron' | 'doto' | 'bitcount-single'

export interface CustomColors {
  primary: string
  primaryHover: string
  background: string
  secondary?: string
}

export interface Settings {
  theme: Theme
  colorScheme: ColorScheme
  fontPreset: FontPreset
  calendarUrls: string[]
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
  customColors?: CustomColors
}

export const FONT_PRESET_OPTIONS: ReadonlyArray<{
  id: FontPreset
  label: string
  fontFamily: string
  fontFamilyMono: string
}> = [
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Geist Mono', 'Bitcount Single', 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    fontFamily: "'JetBrains Mono', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Geist Mono', 'Bitcount Single', 'SF Mono', 'Consolas', monospace",
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    fontFamily: "'Geist Mono', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'Geist Mono', 'JetBrains Mono', 'Bitcount Single', 'SF Mono', 'Consolas', monospace",
  },
  {
    id: 'pixelify-sans',
    label: 'Pixelify Sans',
    fontFamily: "'Pixelify Sans', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'Bitcount Single', 'JetBrains Mono', 'Geist Mono', 'SF Mono', 'Consolas', monospace",
  },
  {
    id: 'orbitron',
    label: 'Orbitron',
    fontFamily: "'Orbitron', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'Geist Mono', 'JetBrains Mono', 'Bitcount Single', 'SF Mono', 'Consolas', monospace",
  },
  {
    id: 'doto',
    label: 'Doto',
    fontFamily: "'Doto', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Geist Mono', 'Bitcount Single', 'SF Mono', 'Consolas', monospace",
  },
  {
    id: 'bitcount-single',
    label: 'Bitcount Single',
    fontFamily: "'Bitcount Single', 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMono: "'Bitcount Single', 'JetBrains Mono', 'Geist Mono', 'SF Mono', 'Consolas', monospace",
  },
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  colorScheme: 'system',
  fontPreset: 'space-grotesk',
  calendarUrls: [],
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  customColors: {
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    background: '#0f172a',
  },
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

function normalizeFontPreset(fontPreset: unknown): FontPreset {
  if (typeof fontPreset !== 'string') {
    return DEFAULT_SETTINGS.fontPreset
  }

  const matched = FONT_PRESET_OPTIONS.find((option) => option.id === fontPreset)
  return matched?.id ?? DEFAULT_SETTINGS.fontPreset
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as StoredSettings
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fontPreset: normalizeFontPreset((parsed as { fontPreset?: unknown }).fontPreset),
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
  const selectedFontPreset =
    FONT_PRESET_OPTIONS.find((option) => option.id === settings.fontPreset)
    ?? FONT_PRESET_OPTIONS.find((option) => option.id === DEFAULT_SETTINGS.fontPreset)

  if (selectedFontPreset) {
    document.documentElement.style.setProperty('--font-family', selectedFontPreset.fontFamily)
    document.documentElement.style.setProperty('--font-family-mono', selectedFontPreset.fontFamilyMono)
  }

  // Apply custom colors if theme is custom
  if (settings.theme === 'custom' && settings.customColors) {
    document.documentElement.style.setProperty('--color-accent', settings.customColors.primary)
    document.documentElement.style.setProperty('--color-accent-hover', settings.customColors.primaryHover)
    document.documentElement.style.setProperty('--color-custom-bg', settings.customColors.background)
  }

  document.documentElement.setAttribute('data-theme', settings.theme)
  document.documentElement.setAttribute('data-color-scheme', resolved)
}
