import { createSavedMediaLink, normalizeSavedMediaLinks, type SavedMediaLink } from './mediaLinks'

export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature' | 'ocean' | 'sunset' | 'custom'
export type FontPreset = 'space-grotesk' | 'jetbrains-mono' | 'geist-mono' | 'pixelify-sans' | 'orbitron' | 'doto' | 'bitcount-single'
export type WeatherUnitSystem = 'metric' | 'imperial'
export type CalendarWeekStartsOn = 'sunday' | 'monday'

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
  calendarShowMonthlyOverview: boolean
  calendarShowAllDayEvents: boolean
  calendarWeekStartsOn: CalendarWeekStartsOn
  weatherRefreshMinutes: number
  weatherUnitSystem: WeatherUnitSystem
  weatherShowExtraDetails: boolean
  spotifyEmbedUrl: string
  spotifyEmbedLinks: SavedMediaLink[]
  appleMusicEmbedUrl: string
  appleMusicEmbedLinks: SavedMediaLink[]
  applePodcastEmbedUrl: string
  applePodcastEmbedLinks: SavedMediaLink[]
  stockSymbols: string[]
  currencyPairs: [string, string][]
  financeRefreshMinutes: number
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
  worldClockCity: string
  worldClockTimeZone: string
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
  calendarShowMonthlyOverview: true,
  calendarShowAllDayEvents: true,
  calendarWeekStartsOn: 'monday',
  weatherRefreshMinutes: 10,
  weatherUnitSystem: 'metric',
  weatherShowExtraDetails: true,
  spotifyEmbedUrl: '',
  spotifyEmbedLinks: [],
  appleMusicEmbedUrl: '',
  appleMusicEmbedLinks: [],
  applePodcastEmbedUrl: '',
  applePodcastEmbedLinks: [],
  stockSymbols: ['AAPL'],
  currencyPairs: [['USD', 'EUR']],
  financeRefreshMinutes: 10,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  worldClockCity: 'New York',
  worldClockTimeZone: 'America/New_York',
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
  // Legacy single-value finance fields (migrated to arrays)
  stockSymbol?: unknown
  currencyBase?: unknown
  currencyTarget?: unknown
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

function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

function normalizeWorldClockCity(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SETTINGS.worldClockCity
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.worldClockCity
}

function normalizeWorldClockTimeZone(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SETTINGS.worldClockTimeZone
  }

  const trimmed = value.trim()
  return trimmed.length > 0 && isValidIanaTimeZone(trimmed)
    ? trimmed
    : DEFAULT_SETTINGS.worldClockTimeZone
}

function normalizeEmbedUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTickerSymbol(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : fallback
}

function normalizeCurrencyCode(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback
}

function normalizeStockSymbols(value: unknown): string[] {
  // Migrate from legacy single string field
  if (typeof value === 'string') {
    const sym = value.trim().toUpperCase()
    return sym.length > 0 ? [sym] : DEFAULT_SETTINGS.stockSymbols
  }

  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_SETTINGS.stockSymbols
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const item of value) {
    const sym = normalizeTickerSymbol(item, '')
    if (sym && !seen.has(sym)) {
      seen.add(sym)
      result.push(sym)
    }
  }

  return result.length > 0 ? result : DEFAULT_SETTINGS.stockSymbols
}

function normalizeCurrencyPairs(
  pairs: unknown,
  legacyBase?: unknown,
  legacyTarget?: unknown,
): [string, string][] {
  // Migrate from legacy separate base/target fields
  if (!Array.isArray(pairs) || pairs.length === 0) {
    const base = normalizeCurrencyCode(legacyBase, '')
    const target = normalizeCurrencyCode(legacyTarget, '')
    if (base && target) return [[base, target]]
    return DEFAULT_SETTINGS.currencyPairs
  }

  const seen = new Set<string>()
  const result: [string, string][] = []

  for (const item of pairs) {
    if (!Array.isArray(item) || item.length < 2) continue
    const base = normalizeCurrencyCode(item[0], '')
    const target = normalizeCurrencyCode(item[1], '')
    if (!base || !target) continue
    const key = `${base}/${target}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push([base, target])
    }
  }

  return result.length > 0 ? result : DEFAULT_SETTINGS.currencyPairs
}

function normalizeFinanceRefreshMinutes(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.financeRefreshMinutes
  }

  return Math.max(1, Math.round(value))
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

function normalizeCalendarShowMonthlyOverview(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    return DEFAULT_SETTINGS.calendarShowMonthlyOverview
  }

  return value
}

function normalizeCalendarWeekStartsOn(value: unknown): CalendarWeekStartsOn {
  return value === 'sunday' || value === 'monday' ? (value as CalendarWeekStartsOn) : DEFAULT_SETTINGS.calendarWeekStartsOn
}

function normalizeCustomBackground(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_CUSTOM_COLORS.background
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_CUSTOM_COLORS.background
}

function normalizePomodoroWorkMinutes(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.pomodoroWorkMinutes
  }

  return Math.max(1, Math.round(value))
}

function normalizePomodoroBreakMinutes(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.pomodoroBreakMinutes
  }

  return Math.max(1, Math.round(value))
}

function normalizeCustomColors(value: unknown): CustomColors {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CUSTOM_COLORS
  }

  const obj = value as Record<string, unknown>
  return {
    primary: isHexColor(obj.primary) ? (obj.primary as string) : DEFAULT_CUSTOM_COLORS.primary,
    primaryHover: isHexColor(obj.primaryHover) ? (obj.primaryHover as string) : DEFAULT_CUSTOM_COLORS.primaryHover,
    background: normalizeCustomBackground(obj.background),
    fontColor: typeof obj.fontColor === 'string' && obj.fontColor.trim().length > 0 ? obj.fontColor.trim() : DEFAULT_CUSTOM_COLORS.fontColor,
    secondaryFontColor: typeof obj.secondaryFontColor === 'string' && obj.secondaryFontColor.trim().length > 0 ? obj.secondaryFontColor.trim() : DEFAULT_CUSTOM_COLORS.secondaryFontColor,
  }
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
      calendarShowMonthlyOverview: normalizeCalendarShowMonthlyOverview(
        (rest as { calendarShowMonthlyOverview?: unknown }).calendarShowMonthlyOverview,
      ),
      calendarShowAllDayEvents: normalizeCalendarShowAllDayEvents(
        (rest as { calendarShowAllDayEvents?: unknown }).calendarShowAllDayEvents,
      ),
      calendarWeekStartsOn: normalizeCalendarWeekStartsOn(
        (rest as { calendarWeekStartsOn?: unknown }).calendarWeekStartsOn,
      ),
      weatherRefreshMinutes: normalizeWeatherRefreshMinutes(rest.weatherRefreshMinutes),
      weatherUnitSystem: normalizeWeatherUnitSystem(rest.weatherUnitSystem),
      weatherShowExtraDetails: normalizeWeatherShowExtraDetails(rest.weatherShowExtraDetails),
      worldClockCity: normalizeWorldClockCity((rest as { worldClockCity?: unknown }).worldClockCity),
      worldClockTimeZone: normalizeWorldClockTimeZone((rest as { worldClockTimeZone?: unknown }).worldClockTimeZone),
      spotifyEmbedUrl: normalizeEmbedUrl((rest as { spotifyEmbedUrl?: unknown }).spotifyEmbedUrl),
      spotifyEmbedLinks: normalizeSavedMediaLinks(
        (rest as { spotifyEmbedLinks?: unknown }).spotifyEmbedLinks,
        (rest as { spotifyEmbedUrl?: unknown }).spotifyEmbedUrl
          ? createSavedMediaLink((rest as { spotifyEmbedUrl?: string }).spotifyEmbedUrl!)
          : undefined,
      ),
      appleMusicEmbedUrl: normalizeEmbedUrl((rest as { appleMusicEmbedUrl?: unknown }).appleMusicEmbedUrl),
      appleMusicEmbedLinks: normalizeSavedMediaLinks(
        (rest as { appleMusicEmbedLinks?: unknown }).appleMusicEmbedLinks,
        (rest as { appleMusicEmbedUrl?: unknown }).appleMusicEmbedUrl
          ? createSavedMediaLink((rest as { appleMusicEmbedUrl?: string }).appleMusicEmbedUrl!)
          : undefined,
      ),
      applePodcastEmbedUrl: normalizeEmbedUrl((rest as { applePodcastEmbedUrl?: unknown }).applePodcastEmbedUrl),
      applePodcastEmbedLinks: normalizeSavedMediaLinks(
        (rest as { applePodcastEmbedLinks?: unknown }).applePodcastEmbedLinks,
        (rest as { applePodcastEmbedUrl?: unknown }).applePodcastEmbedUrl
          ? createSavedMediaLink((rest as { applePodcastEmbedUrl?: string }).applePodcastEmbedUrl!)
          : undefined,
      ),
      stockSymbols: normalizeStockSymbols(
        (rest as { stockSymbols?: unknown }).stockSymbols ?? rest.stockSymbol,
      ),
      currencyPairs: normalizeCurrencyPairs(
        (rest as { currencyPairs?: unknown }).currencyPairs,
        rest.currencyBase,
        rest.currencyTarget,
      ),
      financeRefreshMinutes: normalizeFinanceRefreshMinutes(
        (rest as { financeRefreshMinutes?: unknown }).financeRefreshMinutes,
      ),
      pomodoroWorkMinutes: normalizePomodoroWorkMinutes(
        (rest as { pomodoroWorkMinutes?: unknown }).pomodoroWorkMinutes,
      ),
      pomodoroBreakMinutes: normalizePomodoroBreakMinutes(
        (rest as { pomodoroBreakMinutes?: unknown }).pomodoroBreakMinutes,
      ),
      customColors: normalizeCustomColors(
        (rest as { customColors?: unknown }).customColors,
      ),
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
      spotifyEmbedLinks: normalizeSavedMediaLinks(
        settings.spotifyEmbedLinks,
        settings.spotifyEmbedUrl ? createSavedMediaLink(settings.spotifyEmbedUrl) : undefined,
      ),
      appleMusicEmbedLinks: normalizeSavedMediaLinks(
        settings.appleMusicEmbedLinks,
        settings.appleMusicEmbedUrl ? createSavedMediaLink(settings.appleMusicEmbedUrl) : undefined,
      ),
      applePodcastEmbedLinks: normalizeSavedMediaLinks(
        settings.applePodcastEmbedLinks,
        settings.applePodcastEmbedUrl ? createSavedMediaLink(settings.applePodcastEmbedUrl) : undefined,
      ),
      stockSymbols: normalizeStockSymbols(settings.stockSymbols),
      currencyPairs: normalizeCurrencyPairs(settings.currencyPairs),
      financeRefreshMinutes: normalizeFinanceRefreshMinutes(settings.financeRefreshMinutes),
      pomodoroWorkMinutes: normalizePomodoroWorkMinutes(settings.pomodoroWorkMinutes),
      pomodoroBreakMinutes: normalizePomodoroBreakMinutes(settings.pomodoroBreakMinutes),
      worldClockCity: normalizeWorldClockCity(settings.worldClockCity),
      worldClockTimeZone: normalizeWorldClockTimeZone(settings.worldClockTimeZone),
      customColors: normalizeCustomColors(settings.customColors),
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
    document.documentElement.style.setProperty('--color-custom-bg', normalizeCustomBackground(customColors.background))
    document.documentElement.style.setProperty('--color-custom-text', customColors.fontColor)
    document.documentElement.style.setProperty('--color-custom-text-muted', customColors.secondaryFontColor)
  }

  document.documentElement.setAttribute('data-theme', settings.theme)
  document.documentElement.setAttribute('data-color-scheme', resolved)
}
