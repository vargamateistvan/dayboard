import { createSavedMediaLink, normalizeSavedMediaLinks, type SavedMediaLink } from './mediaLinks'
import {
  loadWidgetLayoutState,
  normalizeWidgetLayoutState,
  saveWidgetLayoutState,
  type WidgetLayoutState,
} from './useWidgetVisibility'

export type ColorScheme = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'retro' | 'futuristic' | 'nature' | 'ocean' | 'sunset' | 'custom'
export type FontPreset = 'space-grotesk' | 'jetbrains-mono' | 'geist-mono' | 'pixelify-sans' | 'orbitron' | 'doto' | 'bitcount-single'
export type WeatherUnitSystem = 'metric' | 'imperial'
export type CalendarWeekStartsOn = 'sunday' | 'monday'
export type CalendarExtraInfoPreview = 'monthly' | 'weekly'
export type SportsSport = 'soccer' | 'basketball' | 'american_football' | 'baseball' | 'hockey'
export type SportsLeagueId =
  | 'EPL'
  | 'LALIGA'
  | 'SERIE_A'
  | 'BUNDESLIGA'
  | 'LIGUE_1'
  | 'UCL'
  | 'UEL'
  | 'UECL'
  | 'EREDIVISIE'
  | 'PRIMEIRA_LIGA'
  | 'NBA'
  | 'NFL'
  | 'MLB'
  | 'NHL'

export interface SportsLeagueOption {
  id: SportsLeagueId
  label: string
  sport: SportsSport
  providerLeagueName: string
}

export interface SportsFavoriteTeam {
  id: string
  name: string
  leagueId: SportsLeagueId
  leagueName: string
  sport: SportsSport
  badgeUrl?: string
}

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
}

export interface Settings {
  theme: Theme
  colorScheme: ColorScheme
  fontPreset: FontPreset
  showBuyMeACoffeeWidget: boolean
  calendarFeeds: CalendarFeed[]
  globalCalendarFeeds: CalendarFeed[]
  calendarHidePastEvents: boolean
  calendarShowMonthlyOverview: boolean
  calendarExtraInfoPreview: CalendarExtraInfoPreview
  calendarShowAllDayEvents: boolean
  calendarWeekStartsOn: CalendarWeekStartsOn
  weatherRefreshMinutes: number
  weatherUnitSystem: WeatherUnitSystem
  weatherShowExtraDetails: boolean
  flightsRadiusKm: number
  flightsRadarRadiusKm: number
  flightsRefreshSeconds: number
  flightsShowLabels: boolean
  flightsShowOnlyAirborne: boolean
  flightsUseDeviceLocation: boolean
  flightsManualLatitude: string
  flightsManualLongitude: string
  spotifyEmbedUrl: string
  spotifyEmbedLinks: SavedMediaLink[]
  appleMusicEmbedUrl: string
  appleMusicEmbedLinks: SavedMediaLink[]
  applePodcastEmbedUrl: string
  applePodcastEmbedLinks: SavedMediaLink[]
  stockSymbols: string[]
  currencyPairs: [string, string][]
  financeRefreshMinutes: number
  sportsFavoriteTeams: SportsFavoriteTeam[]
  sportsEnabledLeagues: SportsLeagueId[]
  sportsRefreshMinutes: number
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
  worldClockCity: string
  worldClockTimeZone: string
  customColors?: CustomColors
}

export const SPORTS_LEAGUE_OPTIONS: ReadonlyArray<SportsLeagueOption> = [
  { id: 'EPL', label: 'Premier League', sport: 'soccer', providerLeagueName: 'English Premier League' },
  { id: 'LALIGA', label: 'La Liga', sport: 'soccer', providerLeagueName: 'Spanish La Liga' },
  { id: 'SERIE_A', label: 'Serie A', sport: 'soccer', providerLeagueName: 'Italian Serie A' },
  { id: 'BUNDESLIGA', label: 'Bundesliga', sport: 'soccer', providerLeagueName: 'German Bundesliga' },
  { id: 'LIGUE_1', label: 'Ligue 1', sport: 'soccer', providerLeagueName: 'French Ligue 1' },
  { id: 'UCL', label: 'Champions League', sport: 'soccer', providerLeagueName: 'UEFA Champions League' },
  { id: 'UEL', label: 'Europa League', sport: 'soccer', providerLeagueName: 'UEFA Europa League' },
  { id: 'UECL', label: 'Conference League', sport: 'soccer', providerLeagueName: 'UEFA Europa Conference League' },
  { id: 'EREDIVISIE', label: 'Eredivisie', sport: 'soccer', providerLeagueName: 'Dutch Eredivisie' },
  { id: 'PRIMEIRA_LIGA', label: 'Primeira Liga', sport: 'soccer', providerLeagueName: 'Portuguese Primeira Liga' },
  { id: 'NBA', label: 'NBA', sport: 'basketball', providerLeagueName: 'NBA' },
  { id: 'NFL', label: 'NFL', sport: 'american_football', providerLeagueName: 'NFL' },
  { id: 'MLB', label: 'MLB', sport: 'baseball', providerLeagueName: 'MLB' },
  { id: 'NHL', label: 'NHL', sport: 'hockey', providerLeagueName: 'NHL' },
] as const

const DEFAULT_SPORTS_ENABLED_LEAGUES: SportsLeagueId[] = SPORTS_LEAGUE_OPTIONS.map((league) => league.id)

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
  globalCalendarFeeds: [],
  calendarHidePastEvents: false,
  calendarShowMonthlyOverview: true,
  calendarExtraInfoPreview: 'monthly',
  calendarShowAllDayEvents: true,
  calendarWeekStartsOn: 'monday',
  weatherRefreshMinutes: 10,
  weatherUnitSystem: 'metric',
  weatherShowExtraDetails: true,
  flightsRadiusKm: 50,
  flightsRadarRadiusKm: 25,
  flightsRefreshSeconds: 2,
  flightsShowLabels: true,
  flightsShowOnlyAirborne: true,
  flightsUseDeviceLocation: true,
  flightsManualLatitude: '',
  flightsManualLongitude: '',
  spotifyEmbedUrl: '',
  spotifyEmbedLinks: [],
  appleMusicEmbedUrl: '',
  appleMusicEmbedLinks: [],
  applePodcastEmbedUrl: '',
  applePodcastEmbedLinks: [],
  stockSymbols: ['AAPL'],
  currencyPairs: [['USD', 'EUR']],
  financeRefreshMinutes: 10,
  sportsFavoriteTeams: [],
  sportsEnabledLeagues: DEFAULT_SPORTS_ENABLED_LEAGUES,
  sportsRefreshMinutes: 15,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  worldClockCity: 'New York',
  worldClockTimeZone: 'America/New_York',
  customColors: DEFAULT_CUSTOM_COLORS,
}

const LEGACY_DEFAULT_FLIGHTS_RADIUS_KM = 25

const STORAGE_KEY = 'dayboard:settings'
const PRESET_STORAGE_KEY = 'dayboard:settings-presets'
const LEGACY_PROFILE_STORAGE_KEY = 'settings_profiles'
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

interface StoredPreset {
  name?: unknown
  settings?: unknown
  layout?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  schedule?: unknown
}

function isHexColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim())
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function normalizeCalendarColor(color: unknown, fallback: string): string {
  return isHexColor(color) ? (color as string).trim() : fallback
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
  return normalizePositiveInteger(value, DEFAULT_SETTINGS.weatherRefreshMinutes)
}

function normalizeWeatherUnitSystem(value: unknown): WeatherUnitSystem {
  return value === 'imperial' ? 'imperial' : 'metric'
}

function normalizeWeatherShowExtraDetails(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.weatherShowExtraDetails)
}

function normalizeFlightsRadiusKm(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.flightsRadiusKm
  }

  // Migrate the original default radius to the new 50 km default.
  if (Math.round(value) === LEGACY_DEFAULT_FLIGHTS_RADIUS_KM) {
    return DEFAULT_SETTINGS.flightsRadiusKm
  }

  return Math.min(250, Math.max(5, Math.round(value)))
}

function normalizeFlightsRadarRadiusKm(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.flightsRadarRadiusKm
  }

  return Math.min(250, Math.max(5, Math.round(value)))
}

function normalizeFlightsRefreshSeconds(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.flightsRefreshSeconds
  }

  return Math.min(3_600, Math.max(2, Math.round(value)))
}

function normalizeFlightsShowLabels(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.flightsShowLabels)
}

function normalizeFlightsShowOnlyAirborne(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.flightsShowOnlyAirborne)
}

function normalizeFlightsUseDeviceLocation(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.flightsUseDeviceLocation)
}

function normalizeFlightsCoordinate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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
  return normalizeNonEmptyString(value, DEFAULT_SETTINGS.worldClockCity)
}

function normalizeWorldClockTimeZone(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
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

function normalizeSportsSport(value: unknown): SportsSport {
  switch (value) {
    case 'soccer':
    case 'basketball':
    case 'american_football':
    case 'baseball':
    case 'hockey':
      return value
    default:
      return 'soccer'
  }
}

function isSportsLeagueId(value: unknown): value is SportsLeagueId {
  return typeof value === 'string' && SPORTS_LEAGUE_OPTIONS.some((league) => league.id === value)
}

function normalizeSportsEnabledLeagues(value: unknown): SportsLeagueId[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_SETTINGS.sportsEnabledLeagues
  }

  const seen = new Set<SportsLeagueId>()
  const normalized: SportsLeagueId[] = []
  for (const entry of value) {
    if (isSportsLeagueId(entry) && !seen.has(entry)) {
      seen.add(entry)
      normalized.push(entry)
    }
  }

  return normalized.length > 0 ? normalized : DEFAULT_SETTINGS.sportsEnabledLeagues
}

function normalizeSportsFavoriteTeams(value: unknown): SportsFavoriteTeam[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: SportsFavoriteTeam[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const team = entry as Partial<SportsFavoriteTeam>
    if (!team.id || typeof team.id !== 'string') {
      continue
    }
    if (!team.name || typeof team.name !== 'string') {
      continue
    }
    if (!isSportsLeagueId(team.leagueId)) {
      continue
    }

    const key = `${team.leagueId}:${team.id.trim()}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push({
      id: team.id.trim(),
      name: team.name.trim(),
      leagueId: team.leagueId,
      leagueName: typeof team.leagueName === 'string' && team.leagueName.trim().length > 0
        ? team.leagueName.trim()
        : SPORTS_LEAGUE_OPTIONS.find((league) => league.id === team.leagueId)?.label ?? team.leagueId,
      sport: normalizeSportsSport(team.sport),
      badgeUrl: typeof team.badgeUrl === 'string' && team.badgeUrl.trim().length > 0 ? team.badgeUrl.trim() : undefined,
    })
  }

  return normalized
}

function normalizeSportsRefreshMinutes(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.sportsRefreshMinutes
  }

  return Math.min(1_440, Math.max(1, Math.round(value)))
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return Math.max(1, Math.round(value))
}

function normalizeBuyMeACoffeeWidget(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.showBuyMeACoffeeWidget)
}

function normalizeCalendarHidePastEvents(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.calendarHidePastEvents)
}

function normalizeCalendarShowAllDayEvents(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.calendarShowAllDayEvents)
}

function normalizeCalendarShowMonthlyOverview(value: unknown): boolean {
  return normalizeBoolean(value, DEFAULT_SETTINGS.calendarShowMonthlyOverview)
}

function normalizeCalendarExtraInfoPreview(value: unknown): CalendarExtraInfoPreview {
  return value === 'monthly' || value === 'weekly'
    ? (value as CalendarExtraInfoPreview)
    : DEFAULT_SETTINGS.calendarExtraInfoPreview
}

function normalizeCalendarWeekStartsOn(value: unknown): CalendarWeekStartsOn {
  return value === 'sunday' || value === 'monday' ? (value as CalendarWeekStartsOn) : DEFAULT_SETTINGS.calendarWeekStartsOn
}

function normalizeCustomBackground(value: unknown): string {
  return normalizeNonEmptyString(value, DEFAULT_CUSTOM_COLORS.background)
}

function normalizePomodoroWorkMinutes(value: unknown): number {
  return normalizePositiveInteger(value, DEFAULT_SETTINGS.pomodoroWorkMinutes)
}

function normalizePomodoroBreakMinutes(value: unknown): number {
  return normalizePositiveInteger(value, DEFAULT_SETTINGS.pomodoroBreakMinutes)
}

function normalizeCustomColors(value: unknown): CustomColors {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CUSTOM_COLORS
  }

  const obj = value as Record<string, unknown>
  return {
    primary: normalizeNonEmptyString(obj.primary, DEFAULT_CUSTOM_COLORS.primary),
    primaryHover: normalizeNonEmptyString(obj.primaryHover, DEFAULT_CUSTOM_COLORS.primaryHover),
    background: normalizeCustomBackground(obj.background),
    fontColor: normalizeNonEmptyString(obj.fontColor, DEFAULT_CUSTOM_COLORS.fontColor),
    secondaryFontColor: normalizeNonEmptyString(obj.secondaryFontColor, DEFAULT_CUSTOM_COLORS.secondaryFontColor),
  }
}

function normalizeStoredSettings(value: unknown): Settings | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const parsed = value as StoredSettings
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
    globalCalendarFeeds: normalizeCalendarFeeds((rest as { globalCalendarFeeds?: unknown }).globalCalendarFeeds),
    calendarHidePastEvents: normalizeCalendarHidePastEvents(
      (rest as { calendarHidePastEvents?: unknown }).calendarHidePastEvents,
    ),
    calendarShowMonthlyOverview: normalizeCalendarShowMonthlyOverview(
      (rest as { calendarShowMonthlyOverview?: unknown }).calendarShowMonthlyOverview,
    ),
    calendarExtraInfoPreview: normalizeCalendarExtraInfoPreview(
      (rest as { calendarExtraInfoPreview?: unknown }).calendarExtraInfoPreview,
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
    flightsRadiusKm: normalizeFlightsRadiusKm((rest as { flightsRadiusKm?: unknown }).flightsRadiusKm),
    flightsRadarRadiusKm: normalizeFlightsRadarRadiusKm((rest as { flightsRadarRadiusKm?: unknown }).flightsRadarRadiusKm),
    flightsRefreshSeconds: normalizeFlightsRefreshSeconds((rest as { flightsRefreshSeconds?: unknown }).flightsRefreshSeconds),
    flightsShowLabels: normalizeFlightsShowLabels((rest as { flightsShowLabels?: unknown }).flightsShowLabels),
    flightsShowOnlyAirborne: normalizeFlightsShowOnlyAirborne((rest as { flightsShowOnlyAirborne?: unknown }).flightsShowOnlyAirborne),
    flightsUseDeviceLocation: normalizeFlightsUseDeviceLocation((rest as { flightsUseDeviceLocation?: unknown }).flightsUseDeviceLocation),
    flightsManualLatitude: normalizeFlightsCoordinate((rest as { flightsManualLatitude?: unknown }).flightsManualLatitude),
    flightsManualLongitude: normalizeFlightsCoordinate((rest as { flightsManualLongitude?: unknown }).flightsManualLongitude),
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
    sportsFavoriteTeams: normalizeSportsFavoriteTeams(
      (rest as { sportsFavoriteTeams?: unknown }).sportsFavoriteTeams,
    ),
    sportsEnabledLeagues: normalizeSportsEnabledLeagues(
      (rest as { sportsEnabledLeagues?: unknown }).sportsEnabledLeagues,
    ),
    sportsRefreshMinutes: normalizeSportsRefreshMinutes(
      (rest as { sportsRefreshMinutes?: unknown }).sportsRefreshMinutes,
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
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeStoredSettings(JSON.parse(raw)) ?? { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      theme: settings.theme,
      colorScheme: settings.colorScheme,
      fontPreset: normalizeFontPreset(settings.fontPreset),
      showBuyMeACoffeeWidget: normalizeBuyMeACoffeeWidget(settings.showBuyMeACoffeeWidget),
      calendarFeeds: normalizeCalendarFeeds(settings.calendarFeeds),
      globalCalendarFeeds: normalizeCalendarFeeds(settings.globalCalendarFeeds),
      calendarHidePastEvents: normalizeCalendarHidePastEvents(settings.calendarHidePastEvents),
      calendarShowMonthlyOverview: normalizeCalendarShowMonthlyOverview(settings.calendarShowMonthlyOverview),
      calendarExtraInfoPreview: normalizeCalendarExtraInfoPreview(settings.calendarExtraInfoPreview),
      calendarShowAllDayEvents: normalizeCalendarShowAllDayEvents(settings.calendarShowAllDayEvents),
      calendarWeekStartsOn: normalizeCalendarWeekStartsOn(settings.calendarWeekStartsOn),
      weatherRefreshMinutes: normalizeWeatherRefreshMinutes(settings.weatherRefreshMinutes),
      weatherUnitSystem: normalizeWeatherUnitSystem(settings.weatherUnitSystem),
      weatherShowExtraDetails: normalizeWeatherShowExtraDetails(settings.weatherShowExtraDetails),
      flightsRadiusKm: normalizeFlightsRadiusKm(settings.flightsRadiusKm),
      flightsRadarRadiusKm: normalizeFlightsRadarRadiusKm(settings.flightsRadarRadiusKm),
      flightsRefreshSeconds: normalizeFlightsRefreshSeconds(settings.flightsRefreshSeconds),
      flightsShowLabels: normalizeFlightsShowLabels(settings.flightsShowLabels),
      flightsShowOnlyAirborne: normalizeFlightsShowOnlyAirborne(settings.flightsShowOnlyAirborne),
      flightsUseDeviceLocation: normalizeFlightsUseDeviceLocation(settings.flightsUseDeviceLocation),
      flightsManualLatitude: normalizeFlightsCoordinate(settings.flightsManualLatitude),
      flightsManualLongitude: normalizeFlightsCoordinate(settings.flightsManualLongitude),
      spotifyEmbedUrl: normalizeEmbedUrl(settings.spotifyEmbedUrl),
      spotifyEmbedLinks: normalizeSavedMediaLinks(
        settings.spotifyEmbedLinks,
        settings.spotifyEmbedUrl ? createSavedMediaLink(settings.spotifyEmbedUrl) : undefined,
      ),
      appleMusicEmbedUrl: normalizeEmbedUrl(settings.appleMusicEmbedUrl),
      appleMusicEmbedLinks: normalizeSavedMediaLinks(
        settings.appleMusicEmbedLinks,
        settings.appleMusicEmbedUrl ? createSavedMediaLink(settings.appleMusicEmbedUrl) : undefined,
      ),
      applePodcastEmbedUrl: normalizeEmbedUrl(settings.applePodcastEmbedUrl),
      applePodcastEmbedLinks: normalizeSavedMediaLinks(
        settings.applePodcastEmbedLinks,
        settings.applePodcastEmbedUrl ? createSavedMediaLink(settings.applePodcastEmbedUrl) : undefined,
      ),
      stockSymbols: normalizeStockSymbols(settings.stockSymbols),
      currencyPairs: normalizeCurrencyPairs(settings.currencyPairs),
      financeRefreshMinutes: normalizeFinanceRefreshMinutes(settings.financeRefreshMinutes),
      sportsFavoriteTeams: normalizeSportsFavoriteTeams(settings.sportsFavoriteTeams),
      sportsEnabledLeagues: normalizeSportsEnabledLeagues(settings.sportsEnabledLeagues),
      sportsRefreshMinutes: normalizeSportsRefreshMinutes(settings.sportsRefreshMinutes),
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

/**
 * Validates all settings fields for correctness
 * @returns Object with validation result and detailed errors
 */
export function validateSettings(settings: Settings): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!settings.theme || !['default', 'retro', 'futuristic', 'nature', 'ocean', 'sunset', 'custom'].includes(settings.theme)) {
    errors.push('Invalid theme')
  }

  if (!settings.colorScheme || !['light', 'dark', 'system'].includes(settings.colorScheme)) {
    errors.push('Invalid colorScheme')
  }

  if (!settings.fontPreset) {
    errors.push('Invalid fontPreset')
  }

  if (typeof settings.showBuyMeACoffeeWidget !== 'boolean') {
    errors.push('showBuyMeACoffeeWidget must be boolean')
  }

  if (!Array.isArray(settings.calendarFeeds)) {
    errors.push('calendarFeeds must be an array')
  }

  if (settings.weatherRefreshMinutes < 1 || settings.weatherRefreshMinutes > 1440) {
    errors.push('weatherRefreshMinutes must be between 1 and 1440')
  }

  if (!['metric', 'imperial'].includes(settings.weatherUnitSystem)) {
    errors.push('Invalid weatherUnitSystem')
  }

  if (settings.flightsRadiusKm < 5 || settings.flightsRadiusKm > 250) {
    errors.push('flightsRadiusKm must be between 5 and 250')
  }

  if (settings.flightsRadarRadiusKm < 5 || settings.flightsRadarRadiusKm > 250) {
    errors.push('flightsRadarRadiusKm must be between 5 and 250')
  }

  if (settings.flightsRefreshSeconds < 2 || settings.flightsRefreshSeconds > 3600) {
    errors.push('flightsRefreshSeconds must be between 2 and 3600')
  }

  if (typeof settings.flightsShowLabels !== 'boolean') {
    errors.push('flightsShowLabels must be boolean')
  }

  if (typeof settings.flightsShowOnlyAirborne !== 'boolean') {
    errors.push('flightsShowOnlyAirborne must be boolean')
  }

  if (typeof settings.flightsUseDeviceLocation !== 'boolean') {
    errors.push('flightsUseDeviceLocation must be boolean')
  }

  if (typeof settings.flightsManualLatitude !== 'string') {
    errors.push('flightsManualLatitude must be a string')
  }

  if (typeof settings.flightsManualLongitude !== 'string') {
    errors.push('flightsManualLongitude must be a string')
  }

  if (settings.pomodoroWorkMinutes < 1 || settings.pomodoroWorkMinutes > 120) {
    errors.push('pomodoroWorkMinutes must be between 1 and 120')
  }

  if (settings.pomodoroBreakMinutes < 1 || settings.pomodoroBreakMinutes > 120) {
    errors.push('pomodoroBreakMinutes must be between 1 and 120')
  }

  if (!Array.isArray(settings.stockSymbols) || settings.stockSymbols.length === 0) {
    errors.push('stockSymbols must be a non-empty array')
  }

  if (!Array.isArray(settings.currencyPairs) || settings.currencyPairs.length === 0) {
    errors.push('currencyPairs must be a non-empty array')
  }

  if (settings.financeRefreshMinutes < 1 || settings.financeRefreshMinutes > 1440) {
    errors.push('financeRefreshMinutes must be between 1 and 1440')
  }

  if (!Array.isArray(settings.sportsFavoriteTeams)) {
    errors.push('sportsFavoriteTeams must be an array')
  }

  if (!Array.isArray(settings.sportsEnabledLeagues) || settings.sportsEnabledLeagues.length === 0) {
    errors.push('sportsEnabledLeagues must be a non-empty array')
  }

  if (settings.sportsRefreshMinutes < 1 || settings.sportsRefreshMinutes > 1440) {
    errors.push('sportsRefreshMinutes must be between 1 and 1440')
  }

  if (typeof settings.worldClockCity !== 'string' || settings.worldClockCity.trim().length === 0) {
    errors.push('worldClockCity must be a non-empty string')
  }

  if (!isValidIanaTimeZone(settings.worldClockTimeZone)) {
    errors.push('Invalid worldClockTimeZone')
  }

  if (settings.customColors) {
    if (typeof settings.customColors.primary !== 'string' || settings.customColors.primary.trim().length === 0) {
      errors.push('customColors.primary must be a non-empty string')
    }
    if (typeof settings.customColors.fontColor !== 'string' || settings.customColors.fontColor.trim().length === 0) {
      errors.push('customColors.fontColor must be a non-empty string')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Resets all settings to defaults
 */
export function resetSettings(): void {
  saveSettings({ ...DEFAULT_SETTINGS })
  window.dispatchEvent(new CustomEvent('settingsReset'))
}

/**
 * Resets a specific settings field to its default value
 */
export function resetField<K extends keyof Settings>(key: K): void {
  const current = loadSettings()
  current[key] = DEFAULT_SETTINGS[key]
  saveSettings(current)
  window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { field: key } }))
}

/**
 * Exports current settings as JSON string
 * @param pretty Whether to format JSON with indentation
 */
export function exportSettings(pretty = true): string {
  const settings = loadSettings()
  return JSON.stringify(settings, null, pretty ? 2 : 0)
}

/**
 * Imports settings from JSON string
 * @returns Validated settings or null if invalid
 */
export function importSettings(json: string): Settings | null {
  try {
    const normalized = normalizeStoredSettings(JSON.parse(json))
    if (!normalized) {
      return null
    }

    const validation = validateSettings(normalized)
    if (!validation.valid) {
      console.warn('Imported settings have validation errors:', validation.errors)
      return null
    }

    return normalized
  } catch (error) {
    console.error('Failed to import settings:', error)
    return null
  }
}

/**
 * Gets all settings fields that differ from defaults
 */
export function getSettingsDiff(): Partial<Settings> {
  const current = loadSettings()
  const diff: Partial<Settings> = {}

  for (const key in current) {
    const k = key as keyof Settings
    const currentValue = JSON.stringify(current[k])
    const defaultValue = JSON.stringify(DEFAULT_SETTINGS[k])

    if (currentValue !== defaultValue) {
      Object.assign(diff, { [k]: current[k] })
    }
  }

  return diff
}

/**
 * Enables cross-tab synchronization of settings
 * Settings changed in one tab will be reflected in all other tabs
 */
export function enableCrossTabSync(): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      // Settings changed in another tab
      window.dispatchEvent(
        new CustomEvent('settingsSyncedFromTab', {
          detail: { settings: JSON.parse(event.newValue) },
        })
      )
    }
  }

  window.addEventListener('storage', handleStorageChange)

  // Return cleanup function
  return () => {
    window.removeEventListener('storage', handleStorageChange)
  }
}

/**
 * Type guard to check if a value is valid Settings object
 */
export function isValidSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false

  const s = value as Record<string, unknown>
  return (
    typeof s.theme === 'string' &&
    typeof s.colorScheme === 'string' &&
    typeof s.fontPreset === 'string' &&
    typeof s.showBuyMeACoffeeWidget === 'boolean' &&
    Array.isArray(s.calendarFeeds) &&
    typeof s.weatherRefreshMinutes === 'number' &&
    typeof s.weatherUnitSystem === 'string' &&
    typeof s.pomodoroWorkMinutes === 'number' &&
    typeof s.pomodoroBreakMinutes === 'number' &&
    Array.isArray(s.stockSymbols) &&
    Array.isArray(s.currencyPairs) &&
    Array.isArray(s.sportsFavoriteTeams) &&
    Array.isArray(s.sportsEnabledLeagues) &&
    typeof s.sportsRefreshMinutes === 'number' &&
    typeof s.worldClockCity === 'string' &&
    typeof s.worldClockTimeZone === 'string'
  )
}

/**
 * Settings Profile interface for named configurations
 */
export interface SettingsProfile {
  name: string
  settings: Settings
  layout?: WidgetLayoutState
  createdAt: number
  updatedAt: number
  schedule?: SettingsPresetSchedule
}

export interface SettingsPresetSchedule {
  enabled: boolean
  startTime: string
  endTime: string
}

export type SettingsPreset = SettingsProfile

const DEFAULT_PRESET_SCHEDULE: SettingsPresetSchedule = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
}

function isValidTimeValue(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim())
}

function normalizePresetTime(value: unknown, fallback: string): string {
  return isValidTimeValue(value) ? value.trim() : fallback
}

function normalizePresetSchedule(value: unknown): SettingsPresetSchedule | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const schedule = value as Record<string, unknown>
  return {
    enabled: normalizeBoolean(schedule.enabled, DEFAULT_PRESET_SCHEDULE.enabled),
    startTime: normalizePresetTime(schedule.startTime, DEFAULT_PRESET_SCHEDULE.startTime),
    endTime: normalizePresetTime(schedule.endTime, DEFAULT_PRESET_SCHEDULE.endTime),
  }
}

function readPresetStore(): Record<string, SettingsPreset> {
  const presetJson = localStorage.getItem(PRESET_STORAGE_KEY)
  const legacyJson = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY)

  if (!presetJson && !legacyJson) {
    return {}
  }

  const rawStore = JSON.parse(presetJson ?? legacyJson ?? '{}') as Record<string, StoredPreset>
  const presets: Record<string, SettingsPreset> = {}

  Object.entries(rawStore).forEach(([fallbackName, rawPreset]) => {
    const name = normalizeNonEmptyString(rawPreset?.name, fallbackName)
    const settings = normalizeStoredSettings(rawPreset?.settings)
    if (!settings) {
      return
    }

    const createdAt =
      typeof rawPreset?.createdAt === 'number' && Number.isFinite(rawPreset.createdAt)
        ? rawPreset.createdAt
        : Date.now()
    const updatedAt =
      typeof rawPreset?.updatedAt === 'number' && Number.isFinite(rawPreset.updatedAt)
        ? rawPreset.updatedAt
        : createdAt

    presets[name] = {
      name,
      settings,
      layout: rawPreset?.layout ? normalizeWidgetLayoutState(rawPreset.layout) : undefined,
      createdAt,
      updatedAt,
      schedule: normalizePresetSchedule(rawPreset?.schedule),
    }
  })

  return presets
}

function writePresetStore(presets: Record<string, SettingsPreset>): void {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
}

function dispatchPresetChange(): void {
  window.dispatchEvent(new CustomEvent('settingsPresetsChanged'))
}

function parseTimeMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10))
  return (hours * 60) + minutes
}

export function isPresetScheduledNow(
  schedule: SettingsPresetSchedule | undefined,
  at: Date = new Date(),
): boolean {
  if (!schedule?.enabled) {
    return false
  }

  const start = parseTimeMinutes(schedule.startTime)
  const end = parseTimeMinutes(schedule.endTime)
  const current = at.getHours() * 60 + at.getMinutes()

  if (start === end) {
    return true
  }

  if (start < end) {
    return current >= start && current < end
  }

  return current >= start || current < end
}

export function savePreset(
  name: string,
  settings: Settings = loadSettings(),
  schedule?: SettingsPresetSchedule,
  layout: WidgetLayoutState = loadWidgetLayoutState(),
): void {
  if (!name.trim()) throw new Error('Preset name cannot be empty')

  const presets = readPresetStore()
  const now = Date.now()
  const existingPreset = presets[name]

  presets[name] = {
    name,
    settings: normalizeStoredSettings(settings) ?? loadSettings(),
    layout: normalizeWidgetLayoutState(layout),
    createdAt: existingPreset?.createdAt || now,
    updatedAt: now,
    schedule: schedule ?? existingPreset?.schedule,
  }

  writePresetStore(presets)
  dispatchPresetChange()
}

export function loadPreset(name: string): SettingsPreset | null {
  const presets = readPresetStore()
  return presets[name] ?? null
}

export function applyPreset(name: string): void {
  const preset = loadPreset(name)
  if (!preset) throw new Error(`Preset '${name}' not found`)
  saveSettings(preset.settings)
  if (preset.layout) {
    saveWidgetLayoutState(preset.layout)
  }
}

export function deletePreset(name: string): void {
  const presets = readPresetStore()
  delete presets[name]
  writePresetStore(presets)
  dispatchPresetChange()
}

export function listPresets(): SettingsPreset[] {
  return Object.values(readPresetStore()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function renamePreset(oldName: string, newName: string): void {
  const trimmedName = newName.trim()
  if (!trimmedName) throw new Error('Preset name cannot be empty')

  const presets = readPresetStore()
  if (!presets[oldName]) throw new Error(`Preset '${oldName}' not found`)
  if (trimmedName !== oldName && presets[trimmedName]) {
    throw new Error(`Preset '${trimmedName}' already exists`)
  }

  if (trimmedName === oldName) {
    return
  }

  presets[trimmedName] = {
    ...presets[oldName],
    name: trimmedName,
    updatedAt: Date.now(),
  }
  delete presets[oldName]
  writePresetStore(presets)
  dispatchPresetChange()
}

export function updatePresetSchedule(name: string, schedule?: SettingsPresetSchedule): void {
  const presets = readPresetStore()
  if (!presets[name]) throw new Error(`Preset '${name}' not found`)

  presets[name] = {
    ...presets[name],
    updatedAt: Date.now(),
    schedule,
  }

  writePresetStore(presets)
  dispatchPresetChange()
}

export function getActiveScheduledPreset(at: Date = new Date()): SettingsPreset | null {
  const matches = listPresets().filter((preset) => isPresetScheduledNow(preset.schedule, at))
  return matches[0] ?? null
}

/**
 * Saves current settings as a named profile for easy recall
 * @param name - Unique profile name
 * @param settings - Settings to save (defaults to current loaded settings)
 * @throws Error if profile name is empty
 */
export function saveProfile(name: string, settings: Settings = loadSettings()): void {
  savePreset(name, settings)
}

/**
 * Loads a previously saved settings profile by name
 * @param name - Profile name to load
 * @returns Settings from the profile, or null if not found
 */
export function loadProfile(name: string): Settings | null {
  return loadPreset(name)?.settings ?? null
}

/**
 * Applies a saved profile (loads and saves it as current settings)
 * @param name - Profile name to apply
 * @throws Error if profile not found
 */
export function applyProfile(name: string): void {
  applyPreset(name)
}

/**
 * Deletes a saved settings profile
 * @param name - Profile name to delete
 */
export function deleteProfile(name: string): void {
  deletePreset(name)
}

/**
 * Lists all saved settings profiles with metadata
 * @returns Array of profile metadata (without full settings)
 */
export function listProfiles(): Array<{ name: string; createdAt: number; updatedAt: number }> {
  return listPresets().map(p => ({
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
}

/**
 * Renames a saved settings profile
 * @param oldName - Current profile name
 * @param newName - New profile name
 * @throws Error if old profile doesn't exist or new name is empty
 */
export function renameProfile(oldName: string, newName: string): void {
  renamePreset(oldName, newName)
}

/**
 * Exports a saved profile as JSON
 * @param name - Profile name to export
 * @param pretty - Whether to pretty-print JSON (default: true)
 * @returns JSON string of the profile
 * @throws Error if profile not found
 */
export function exportProfile(name: string, pretty = true): string {
  const preset = loadPreset(name)
  if (!preset) throw new Error(`Profile '${name}' not found`)

  return pretty ? JSON.stringify(preset, null, 2) : JSON.stringify(preset)
}

/**
 * Imports a JSON profile and saves it with a new name
 * @param name - Name for the imported profile
 * @param json - JSON string of profile data
 * @returns true if import succeeded, false if JSON is invalid
 */
export function importProfile(name: string, json: string): boolean {
  try {
    const data = JSON.parse(json) as SettingsPreset | { settings: Settings; schedule?: SettingsPresetSchedule }
    const presetSettings = 'settings' in data ? data.settings : data
    const schedule = 'schedule' in data ? normalizePresetSchedule(data.schedule) : undefined

    if (
      !presetSettings ||
      typeof presetSettings !== 'object' ||
      !(
        'theme' in presetSettings ||
        'colorScheme' in presetSettings ||
        'fontPreset' in presetSettings ||
        'calendarFeeds' in presetSettings ||
        'calendarUrl' in presetSettings
      )
    ) {
      return false
    }

    const settings = normalizeStoredSettings(presetSettings)

    if (!settings || !isValidSettings(settings)) return false

    savePreset(name, settings, schedule)
    return true
  } catch {
    return false
  }
}

/**
 * Simple XOR-based encryption (NOT cryptographically secure)
 * Use only for obfuscation. For production, use proper encryption libraries.
 */
function xorEncrypt(data: string, password: string): string {
  let encrypted = ''
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length))
  }
  return btoa(encrypted) // Base64 encode
}

/**
 * XOR-based decryption (matches xorEncrypt)
 */
function xorDecrypt(encrypted: string, password: string): string {
  try {
    const data = atob(encrypted) // Base64 decode
    let decrypted = ''
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(data.charCodeAt(i) ^ password.charCodeAt(i % password.length))
    }
    return decrypted
  } catch {
    return ''
  }
}

/**
 * Encrypted settings data structure
 */
export interface EncryptedSettings {
  encrypted: string
  iv: string // initialization vector for salt
  version: number
}

/**
 * Checks if data appears to be encrypted settings
 * @param data - Data to check
 * @returns true if data looks like encrypted settings
 */
export function isEncrypted(data: unknown): data is EncryptedSettings {
  return (
    typeof data === 'object' &&
    data !== null &&
    'encrypted' in data &&
    'iv' in data &&
    'version' in data &&
    typeof (data as { encrypted?: unknown }).encrypted === 'string' &&
    typeof (data as { iv?: unknown }).iv === 'string' &&
    typeof (data as { version?: unknown }).version === 'number'
  )
}

/**
 * Encrypts settings with a password
 * WARNING: This is basic encryption. For production use, consider crypto libraries.
 * @param settings - Settings to encrypt
 * @param password - Encryption password (min 6 chars)
 * @returns Encrypted data object
 * @throws Error if password is too short
 */
export function encryptSettings(settings: Settings, password: string): EncryptedSettings {
  if (password.length < 6) throw new Error('Password must be at least 6 characters')

  const json = JSON.stringify(settings)
  const iv = Math.random().toString(36).substring(2, 10) // Simple IV (not cryptographically secure)
  const salted = json + iv
  const encrypted = xorEncrypt(salted, password)

  return {
    encrypted,
    iv,
    version: 1,
  }
}

/**
 * Decrypts settings with a password
 * @param encrypted - Encrypted data object
 * @param password - Encryption password
 * @returns Decrypted settings, or null if decryption fails or data is invalid
 */
export function decryptSettings(encrypted: EncryptedSettings, password: string): Settings | null {
  try {
    if (encrypted.version !== 1) return null

    const decrypted = xorDecrypt(encrypted.encrypted, password)
    if (!decrypted) return null

    // Remove IV from decrypted data
    const json = decrypted.substring(0, decrypted.length - encrypted.iv.length)
    const settings = JSON.parse(json) as unknown

    return isValidSettings(settings) ? settings : null
  } catch {
    return null
  }
}

/**
 * Saves encrypted settings to localStorage
 * @param settings - Settings to encrypt and save
 * @param password - Encryption password
 * @throws Error if password is invalid
 */
export function saveEncryptedSettings(settings: Settings, password: string): void {
  const encrypted = encryptSettings(settings, password)
  localStorage.setItem('settings_encrypted', JSON.stringify(encrypted))
}

/**
 * Loads encrypted settings from localStorage
 * @param password - Decryption password
 * @returns Decrypted settings, or null if no encrypted data exists or password is wrong
 */
export function loadEncryptedSettings(password: string): Settings | null {
  const stored = localStorage.getItem('settings_encrypted')
  if (!stored) return null

  try {
    const encrypted = JSON.parse(stored)
    if (!isEncrypted(encrypted)) return null
    return decryptSettings(encrypted, password)
  } catch {
    return null
  }
}

/**
 * Merges global calendar feeds with preset-specific calendar feeds
 * Global feeds are applied to all presets, and preset-specific feeds are added on top
 * @param globalFeeds - Calendar feeds shared across all presets
 * @param presetFeeds - Calendar feeds specific to a preset
 * @returns Combined array of calendar feeds (global feeds first, then preset-specific)
 */
export function mergeCalendarFeeds(
  globalFeeds: CalendarFeed[] = [],
  presetFeeds: CalendarFeed[] = [],
): CalendarFeed[] {
  return [...globalFeeds, ...presetFeeds].filter(feed => feed.url.trim().length > 0)
}
