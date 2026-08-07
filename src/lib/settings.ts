export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature' | 'ocean' | 'sunset' | 'custom'
export type FontPreset = 'space-grotesk' | 'jetbrains-mono' | 'geist-mono' | 'pixelify-sans' | 'orbitron' | 'doto' | 'bitcount-single'
export type WeatherUnitSystem = 'metric' | 'imperial'

export interface CalendarFeed {
  url: string
  color: string
}

export interface CustomColors {
  primary: string
  primaryHover: string
  background: string
  fontColor: string
  secondaryFontColor: string
  secondary?: string
}

export interface Settings {
  theme: Theme
  colorScheme: ColorScheme
  fontPreset: FontPreset
  showBuyMeACoffeeWidget: boolean
  calendarFeeds: CalendarFeed[]
  calendarHidePastEvents: boolean
  calendarShowAllDayEvents: boolean
  weatherRefreshMinutes: number
  weatherUnitSystem: WeatherUnitSystem
  weatherShowExtraDetails: boolean
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
  customColors?: CustomColors
}

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  background: '#0f172a',
  fontColor: '#f5f5f5',
  secondaryFontColor: '#999999',
}

export const DEFAULT_CALENDAR_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
] as const

export const DEFAULT_CALENDAR_COLOR = DEFAULT_CALENDAR_COLORS[0]

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
  showBuyMeACoffeeWidget: true,
  calendarFeeds: [],
  calendarHidePastEvents: false,
  calendarShowAllDayEvents: true,
  weatherRefreshMinutes: 10,
  weatherUnitSystem: 'metric',
  weatherShowExtraDetails: true,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  customColors: DEFAULT_CUSTOM_COLORS,
}

const STORAGE_KEY = 'dayboard:settings'
const CUSTOM_THEME_VARIABLES = [
  '--color-accent',
  '--color-accent-hover',
  '--color-custom-bg',
  '--color-custom-text',
  '--color-custom-text-muted',
] as const

interface StoredSettings extends Partial<Omit<Settings, 'calendarFeeds'>> {
  calendarUrl?: unknown
  calendarUrls?: unknown
  calendarFeeds?: unknown
}

function isHexColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim())
}

function normalizeCalendarColor(color: unknown, fallback: string): string {
  return isHexColor(color) ? color.trim() : fallback
}

function defaultCalendarColor(index: number): string {
  return DEFAULT_CALENDAR_COLORS[index % DEFAULT_CALENDAR_COLORS.length]
}

function normalizeCalendarFeeds(calendarFeeds: unknown, legacyCalendarUrls?: unknown, legacyCalendarUrl?: unknown): CalendarFeed[] {
  const candidateFeeds = Array.isArray(calendarFeeds)
    ? calendarFeeds
    : Array.isArray(legacyCalendarUrls)
      ? legacyCalendarUrls
      : typeof legacyCalendarUrl === 'string'
        ? [legacyCalendarUrl]
        : []

  const normalizedFeeds: CalendarFeed[] = []
  const seenUrls = new Set<string>()

  candidateFeeds.forEach((candidateFeed, index) => {
    const url =
      typeof candidateFeed === 'string'
        ? candidateFeed.trim()
        : candidateFeed && typeof candidateFeed === 'object' && typeof (candidateFeed as { url?: unknown }).url === 'string'
          ? (candidateFeed as { url: string }).url.trim()
          : ''

    if (!url || seenUrls.has(url)) {
      return
    }

    const color =
      typeof candidateFeed === 'string'
        ? defaultCalendarColor(index)
        : candidateFeed && typeof candidateFeed === 'object'
          ? normalizeCalendarColor((candidateFeed as { color?: unknown }).color, defaultCalendarColor(index))
          : defaultCalendarColor(index)

    seenUrls.add(url)
    normalizedFeeds.push({ url, color })
  })

  return normalizedFeeds
}

function normalizeFontPreset(fontPreset: unknown): FontPreset {
  if (typeof fontPreset !== 'string') {
    return DEFAULT_SETTINGS.fontPreset
  }

  const matched = FONT_PRESET_OPTIONS.find((option) => option.id === fontPreset)
  return matched?.id ?? DEFAULT_SETTINGS.fontPreset
}

function normalizeWeatherRefreshMinutes(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.weatherRefreshMinutes
  }

  return Math.max(1, Math.round(value))
}

function normalizeWeatherUnitSystem(value: unknown): WeatherUnitSystem {
  return value === 'imperial' ? 'imperial' : 'metric'
}

function normalizeWeatherShowExtraDetails(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    return DEFAULT_SETTINGS.weatherShowExtraDetails
  }

  return value
}

function normalizeBuyMeACoffeeWidget(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    return DEFAULT_SETTINGS.showBuyMeACoffeeWidget
  }

  return value
}

function normalizeCalendarHidePastEvents(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    return DEFAULT_SETTINGS.calendarHidePastEvents
  }

  return value
}

function normalizeCalendarShowAllDayEvents(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    return DEFAULT_SETTINGS.calendarShowAllDayEvents
  }

  return value
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as StoredSettings
    const {
      calendarUrl,
      calendarUrls,
      calendarFeeds,
      ...rest
    } = parsed
    return {
      ...DEFAULT_SETTINGS,
      ...rest,
      fontPreset: normalizeFontPreset(rest.fontPreset),
      showBuyMeACoffeeWidget: normalizeBuyMeACoffeeWidget(rest.showBuyMeACoffeeWidget),
      calendarFeeds: normalizeCalendarFeeds(calendarFeeds, calendarUrls, calendarUrl),
      calendarHidePastEvents: normalizeCalendarHidePastEvents(
        (rest as { calendarHidePastEvents?: unknown }).calendarHidePastEvents,
      ),
      calendarShowAllDayEvents: normalizeCalendarShowAllDayEvents(
        (rest as { calendarShowAllDayEvents?: unknown }).calendarShowAllDayEvents,
      ),
      weatherRefreshMinutes: normalizeWeatherRefreshMinutes(rest.weatherRefreshMinutes),
      weatherUnitSystem: normalizeWeatherUnitSystem(rest.weatherUnitSystem),
      weatherShowExtraDetails: normalizeWeatherShowExtraDetails(rest.weatherShowExtraDetails),
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
      calendarFeeds: normalizeCalendarFeeds(settings.calendarFeeds),
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

  for (const variableName of CUSTOM_THEME_VARIABLES) {
    document.documentElement.style.removeProperty(variableName)
  }

  if (settings.theme === 'custom') {
    const customColors = settings.customColors ?? DEFAULT_CUSTOM_COLORS

    document.documentElement.style.setProperty('--color-accent', customColors.primary)
    document.documentElement.style.setProperty('--color-accent-hover', customColors.primaryHover)
    document.documentElement.style.setProperty('--color-custom-bg', customColors.background)
    document.documentElement.style.setProperty('--color-custom-text', customColors.fontColor)
    document.documentElement.style.setProperty('--color-custom-text-muted', customColors.secondaryFontColor)
  }

  document.documentElement.setAttribute('data-theme', settings.theme)
  document.documentElement.setAttribute('data-color-scheme', resolved)
}
