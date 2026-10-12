import {
  SPORTS_LEAGUE_OPTIONS,
  type SportsFavoriteTeam,
  type SportsLeagueId,
  type SportsSport,
} from './settings'

interface SportsDbTeam {
  idTeam?: string
  strTeam?: string
  strTeamAlternate?: string
  strLeague?: string
  strLeagueAlternate?: string
  strSport?: string
  idLeague?: string
  strBadge?: string
  strTeamBadge?: string
}

interface SportsDbEvent {
  idEvent?: string
  idHomeTeam?: string
  idAwayTeam?: string
  strHomeTeam?: string
  strAwayTeam?: string
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
  strStatus?: string
  strTimestamp?: string
  dateEvent?: string
}

export type SportsTeamSearchResult = SportsFavoriteTeam

/** FT/AET/PEN are final results; the rest are shown as they are, without a win or loss. */
export type SportsGameStatus = 'FT' | 'AET' | 'PEN' | 'LIVE' | 'SUSP' | 'PST' | 'ABD'

export function isFinalStatus(status: SportsGameStatus): boolean {
  return status === 'FT' || status === 'AET' || status === 'PEN'
}

export interface SportsLastGame {
  teamId: string
  teamName: string
  teamBadgeUrl?: string
  opponentName: string
  opponentBadgeUrl?: string
  teamScore: number
  opponentScore: number
  playedAt: string
  leagueName: string
  result: 'W' | 'L' | 'D'
  status: SportsGameStatus
}

export interface SportsLeagueScore {
  id: string
  leagueId: SportsLeagueId
  leagueName: string
  homeTeamName: string
  homeTeamBadgeUrl?: string
  awayTeamName: string
  awayTeamBadgeUrl?: string
  homeScore: number
  awayScore: number
  playedAt: string
  status: SportsGameStatus
}

const SPORTS_DB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3'
const SPORTS_API_MAX_CONCURRENT_REQUESTS = 4
const SPORTS_API_RETRY_COUNT_FOR_429 = 1
const BADGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LAST_GAME_CACHE_TTL_MS = 2 * 60 * 1000
const LEAGUE_SCORES_CACHE_TTL_MS = 2 * 60 * 1000

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const badgeCache = new Map<string, CacheEntry<string | undefined>>()
const badgeInflight = new Map<string, Promise<string | undefined>>()
const lastGameCache = new Map<string, CacheEntry<SportsLastGame>>()
const lastGameInflight = new Map<string, Promise<SportsLastGame>>()
const leagueScoresCache = new Map<string, CacheEntry<SportsLeagueScore[]>>()
const leagueScoresInflight = new Map<string, Promise<SportsLeagueScore[]>>()

let activeSportsApiRequests = 0
const queuedSportsApiRequests: Array<() => void> = []

function now(): number {
  return Date.now()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function getFreshCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = cache.get(key)
  if (!cached) {
    return null
  }

  if (cached.expiresAt <= now()) {
    cache.delete(key)
    return null
  }

  return cached.value
}

function setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: now() + ttlMs,
  })
}

async function withSportsApiConcurrencyLimit<T>(work: () => Promise<T>): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const execute = () => {
      activeSportsApiRequests += 1
      work()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeSportsApiRequests = Math.max(0, activeSportsApiRequests - 1)
          const next = queuedSportsApiRequests.shift()
          if (next) {
            next()
          }
        })
    }

    if (activeSportsApiRequests < SPORTS_API_MAX_CONCURRENT_REQUESTS) {
      execute()
      return
    }

    queuedSportsApiRequests.push(execute)
  })
}

const MAX_RETRY_DELAY_MS = 10_000

// Honour Retry-After when the free API rate-limits; otherwise back off exponentially.
function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS)
  }
  return Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS)
}

async function fetchSportsDbJson<T>(url: string, errorMessage: string): Promise<T> {
  let attempt = 0
  while (attempt <= SPORTS_API_RETRY_COUNT_FOR_429) {
    const response = await withSportsApiConcurrencyLimit(() => fetch(url))
    if (response.ok) {
      return await response.json() as T
    }

    if (response.status === 429 && attempt < SPORTS_API_RETRY_COUNT_FOR_429) {
      await delay(getRetryDelayMs(response, attempt))
      attempt += 1
      continue
    }

    throw new Error(errorMessage)
  }

  throw new Error(errorMessage)
}

function normalizeLeagueName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseSportsDbSport(value: unknown): SportsSport | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  switch (normalized) {
    case 'soccer':
      return 'soccer'
    case 'basketball':
      return 'basketball'
    case 'american football':
      return 'american_football'
    case 'baseball':
      return 'baseball'
    case 'ice hockey':
      return 'hockey'
    default:
      return null
  }
}

function parseScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pickTeamBadge(team: SportsDbTeam): string | undefined {
  const primary = typeof team.strBadge === 'string' ? team.strBadge.trim() : ''
  if (primary.length > 0) {
    return primary
  }

  const fallback = typeof team.strTeamBadge === 'string' ? team.strTeamBadge.trim() : ''
  return fallback.length > 0 ? fallback : undefined
}

function normalizeTeamName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function matchesTeamQuery(team: SportsDbTeam, normalizedQuery: string): boolean {
  const name = normalizeTeamName(team.strTeam).toLowerCase()
  const altName = normalizeTeamName(team.strTeamAlternate).toLowerCase()
  return name.includes(normalizedQuery) || altName.includes(normalizedQuery)
}

function toSearchResult(team: SportsDbTeam, league: typeof SPORTS_LEAGUE_OPTIONS[number]): SportsTeamSearchResult | null {
  if (!team.idTeam || !team.strTeam) {
    return null
  }

  return {
    id: team.idTeam,
    name: team.strTeam,
    leagueId: league.id,
    leagueName: league.label,
    sport: league.sport,
    badgeUrl: pickTeamBadge(team),
  }
}

function resolveLeagueForTeam(team: SportsDbTeam): typeof SPORTS_LEAGUE_OPTIONS[number] | null {
  const leagueName = normalizeLeagueName(team.strLeague ?? '')
  const leagueAlternateName = normalizeLeagueName(team.strLeagueAlternate ?? '')
  const sport = parseSportsDbSport(team.strSport)
  if (!sport || !leagueName) {
    return null
  }

  return SPORTS_LEAGUE_OPTIONS.find((league) => {
    if (league.sport !== sport) {
      return false
    }

    const leagueIdFromTeam = typeof team.idLeague === 'string' ? team.idLeague.trim() : ''
    const leagueIdMatch = Boolean(league.providerLeagueId) && league.providerLeagueId === leagueIdFromTeam
    if (leagueIdMatch) {
      return true
    }

    const providerName = normalizeLeagueName(league.providerLeagueName)
    const labelName = normalizeLeagueName(league.label)
    return (
      leagueName === providerName ||
      leagueAlternateName === providerName ||
      leagueName === labelName ||
      leagueAlternateName === labelName
    )
  }) ?? null
}

/**
 * TheSportsDB timestamps are UTC but carry no zone ("2026-10-10T11:30:00"),
 * which `new Date()` would read as local time. Date-only events stay a plain
 * calendar date so they show on that day in every time zone.
 */
export function toEventTimestamp(event: Pick<SportsDbEvent, 'strTimestamp' | 'dateEvent'>): string {
  const timestamp = typeof event.strTimestamp === 'string' ? event.strTimestamp.trim() : ''
  if (timestamp.length > 0) {
    return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`
  }
  return event.dateEvent ?? ''
}

export async function searchSportsTeams(
  query: string,
  enabledLeagues: SportsLeagueId[],
): Promise<SportsTeamSearchResult[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) {
    return []
  }

  const data = await fetchSportsDbJson<{ teams?: SportsDbTeam[] | null }>(
    `${SPORTS_DB_BASE_URL}/searchteams.php?t=${encodeURIComponent(trimmedQuery)}`,
    'Could not load teams.',
  )
  const teams = Array.isArray(data.teams) ? data.teams : []
  const enabledSet = new Set<SportsLeagueId>(enabledLeagues)
  const normalizedQuery = trimmedQuery.toLowerCase()
  const results: SportsTeamSearchResult[] = []
  const seen = new Set<string>()

  for (const team of teams) {
    if (!team.idTeam || !team.strTeam) {
      continue
    }

    const league = resolveLeagueForTeam(team)
    if (!league || !enabledSet.has(league.id)) {
      continue
    }

    const searchResult = toSearchResult(team, league)
    if (!searchResult) {
      continue
    }

    const key = `${searchResult.leagueId}:${searchResult.id}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    results.push(searchResult)
  }

  if (results.length < 50) {
    const leagueFetches = SPORTS_LEAGUE_OPTIONS
      .filter((league) => enabledSet.has(league.id))
      .map(async (league) => {
        const fallbackData = await fetchSportsDbJson<{ teams?: SportsDbTeam[] | null }>(
          `${SPORTS_DB_BASE_URL}/search_all_teams.php?l=${encodeURIComponent(league.providerLeagueName)}`,
          'Could not load teams.',
        )
        const fallbackTeams = Array.isArray(fallbackData.teams) ? fallbackData.teams : []
        const leagueResults: SportsTeamSearchResult[] = []

        for (const fallbackTeam of fallbackTeams) {
          if (!matchesTeamQuery(fallbackTeam, normalizedQuery)) {
            continue
          }
          const mapped = toSearchResult(fallbackTeam, league)
          if (mapped) {
            leagueResults.push(mapped)
          }
        }

        return leagueResults
      })

    const fallbackGroups = await Promise.allSettled(leagueFetches)
    for (const group of fallbackGroups) {
      if (group.status !== 'fulfilled') {
        continue
      }

      for (const team of group.value) {
        const key = `${team.leagueId}:${team.id}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        results.push(team)
      }
    }
  }

  results.sort((left, right) => {
    const leagueOrder = left.leagueName.localeCompare(right.leagueName)
    if (leagueOrder !== 0) {
      return leagueOrder
    }
    return left.name.localeCompare(right.name)
  })

  return results.slice(0, 100)
}

export function parseEventStatus(rawStatus: unknown): SportsGameStatus {
  if (typeof rawStatus !== 'string') {
    return 'FT'
  }

  const normalized = rawStatus.trim().toLowerCase()
  // Checked before "pen" so "suspended" is not read as penalties.
  if (normalized.includes('susp') || normalized.includes('interrupt')) return 'SUSP'
  if (normalized.includes('postp') || normalized === 'pst') return 'PST'
  if (normalized.includes('aband') || normalized.includes('cancel') || normalized === 'abd') return 'ABD'
  if (/\bpen\b|penalt|^ap$/.test(normalized)) return 'PEN'
  if (normalized.includes('extra') || normalized === 'aet') return 'AET'
  if (/^(1h|2h|ht|et|bt|p|q[1-4]|ot|live|in progress)$/.test(normalized)) return 'LIVE'
  return 'FT'
}

async function fetchTeamBadgeUrl(teamId: string): Promise<string | undefined> {
  const cachedBadge = getFreshCacheValue(badgeCache, teamId)
  if (cachedBadge !== null) {
    return cachedBadge
  }

  const inflightBadge = badgeInflight.get(teamId)
  if (inflightBadge) {
    return await inflightBadge
  }

  const request = (async () => {
    const data = await fetchSportsDbJson<{ teams?: SportsDbTeam[] | null }>(
      `${SPORTS_DB_BASE_URL}/lookupteam.php?id=${encodeURIComponent(teamId)}`,
      'Could not load team logo.',
    )

    const firstTeam = Array.isArray(data.teams) ? data.teams[0] : null
    const badge = firstTeam ? pickTeamBadge(firstTeam) : undefined
    setCacheValue(badgeCache, teamId, badge, BADGE_CACHE_TTL_MS)
    return badge
  })()

  badgeInflight.set(teamId, request)
  try {
    return await request
  } finally {
    badgeInflight.delete(teamId)
  }
}

export async function fetchLastGameForTeam(team: SportsFavoriteTeam): Promise<SportsLastGame> {
  const teamKey = `${team.leagueId}:${team.id}`
  const cachedGame = getFreshCacheValue(lastGameCache, teamKey)
  if (cachedGame !== null) {
    return cachedGame
  }

  const inflightGame = lastGameInflight.get(teamKey)
  if (inflightGame) {
    return await inflightGame
  }

  const request = (async () => {
    const data = await fetchSportsDbJson<{ results?: SportsDbEvent[] | null }>(
      `${SPORTS_DB_BASE_URL}/eventslast.php?id=${encodeURIComponent(team.id)}`,
      'Could not load last game.',
    )
    const events = Array.isArray(data.results) ? data.results : []
    const completedEvent = events.find((event) => {
      const homeScore = parseScore(event.intHomeScore)
      const awayScore = parseScore(event.intAwayScore)
      return homeScore !== null && awayScore !== null
    })

    if (!completedEvent) {
      throw new Error('No completed games found yet.')
    }

    const homeScore = parseScore(completedEvent.intHomeScore)
    const awayScore = parseScore(completedEvent.intAwayScore)
    if (homeScore === null || awayScore === null) {
      throw new Error('No completed games found yet.')
    }

    const isHomeTeam = completedEvent.idHomeTeam === team.id
    const opponentId = isHomeTeam ? completedEvent.idAwayTeam : completedEvent.idHomeTeam
    const teamScore = isHomeTeam ? homeScore : awayScore
    const opponentScore = isHomeTeam ? awayScore : homeScore
    const opponentName = isHomeTeam
      ? completedEvent.strAwayTeam ?? 'Opponent'
      : completedEvent.strHomeTeam ?? 'Opponent'
    const playedAt = toEventTimestamp(completedEvent)

    const teamBadgePromise = team.badgeUrl && team.badgeUrl.trim().length > 0
      ? Promise.resolve(team.badgeUrl.trim())
      : fetchTeamBadgeUrl(team.id)
    const opponentBadgePromise = opponentId
      ? fetchTeamBadgeUrl(opponentId)
      : Promise.resolve(undefined)
    const [teamBadgeResult, opponentBadgeResult] = await Promise.allSettled([
      teamBadgePromise,
      opponentBadgePromise,
    ])

    const teamBadgeUrl = teamBadgeResult.status === 'fulfilled' ? teamBadgeResult.value : undefined
    const opponentBadgeUrl = opponentBadgeResult.status === 'fulfilled' ? opponentBadgeResult.value : undefined

    const game: SportsLastGame = {
      teamId: team.id,
      teamName: team.name,
      teamBadgeUrl,
      opponentName,
      opponentBadgeUrl,
      teamScore,
      opponentScore,
      playedAt,
      leagueName: team.leagueName,
      result: teamScore === opponentScore ? 'D' : teamScore > opponentScore ? 'W' : 'L',
      status: parseEventStatus(completedEvent.strStatus),
    }

    setCacheValue(lastGameCache, teamKey, game, LAST_GAME_CACHE_TTL_MS)
    return game
  })()

  lastGameInflight.set(teamKey, request)
  try {
    return await request
  } finally {
    lastGameInflight.delete(teamKey)
  }
}

export async function fetchRecentLeagueScores(
  followedLeagues: SportsLeagueId[],
  gamesPerLeague = 6,
): Promise<SportsLeagueScore[]> {
  if (followedLeagues.length === 0) {
    return []
  }

  const followedSet = new Set<SportsLeagueId>(followedLeagues)
  const sortedLeagueIds = [...followedSet].sort()
  const cacheKey = `${sortedLeagueIds.join(',')}::${gamesPerLeague}`
  const cachedScores = getFreshCacheValue(leagueScoresCache, cacheKey)
  if (cachedScores !== null) {
    return cachedScores
  }

  const inflightScores = leagueScoresInflight.get(cacheKey)
  if (inflightScores) {
    return await inflightScores
  }

  const leagues = SPORTS_LEAGUE_OPTIONS.filter(
    (league) => followedSet.has(league.id) && Boolean(league.providerLeagueId),
  )

  const loadLeague = async (league: (typeof leagues)[number]): Promise<SportsLeagueScore[]> => {
    const providerLeagueId = league.providerLeagueId
    if (!providerLeagueId) return []

    const data = await fetchSportsDbJson<{ events?: SportsDbEvent[] | null }>(
      `${SPORTS_DB_BASE_URL}/eventspastleague.php?id=${encodeURIComponent(providerLeagueId)}`,
      'Could not load league scores.',
    )
    const events = (Array.isArray(data.events) ? data.events : [])
      .filter((event) => parseScore(event.intHomeScore) !== null && parseScore(event.intAwayScore) !== null)
      .slice(0, gamesPerLeague)

    // Badges for all games load in parallel (the request queue limits concurrency).
    return Promise.all(
      events.map(async (event) => {
        const [homeBadgeResult, awayBadgeResult] = await Promise.allSettled([
          event.idHomeTeam ? fetchTeamBadgeUrl(event.idHomeTeam) : Promise.resolve(undefined),
          event.idAwayTeam ? fetchTeamBadgeUrl(event.idAwayTeam) : Promise.resolve(undefined),
        ])

        return {
          id: event.idEvent ?? `${league.id}:${event.dateEvent ?? 'unknown'}:${event.strHomeTeam ?? 'home'}:${event.strAwayTeam ?? 'away'}`,
          leagueId: league.id,
          leagueName: league.label,
          homeTeamName: event.strHomeTeam?.trim() || 'Home',
          homeTeamBadgeUrl: homeBadgeResult.status === 'fulfilled' ? homeBadgeResult.value : undefined,
          awayTeamName: event.strAwayTeam?.trim() || 'Away',
          awayTeamBadgeUrl: awayBadgeResult.status === 'fulfilled' ? awayBadgeResult.value : undefined,
          homeScore: parseScore(event.intHomeScore) ?? 0,
          awayScore: parseScore(event.intAwayScore) ?? 0,
          playedAt: toEventTimestamp(event),
          status: parseEventStatus(event.strStatus),
        }
      }),
    )
  }

  const request = (async () => {
    // One failing league must not hide the others.
    const results = await Promise.allSettled(leagues.map(loadLeague))
    const failures = results.filter((result) => result.status === 'rejected')
    if (leagues.length > 0 && failures.length === leagues.length) {
      throw (failures[0] as PromiseRejectedResult).reason
    }

    const allScores = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    const sortedScores = allScores.sort((left, right) => {
      if (left.leagueName !== right.leagueName) {
        return left.leagueName.localeCompare(right.leagueName)
      }
      return right.playedAt.localeCompare(left.playedAt)
    })
    // Partial results are not cached, so the next refresh retries the failed leagues.
    if (failures.length === 0) {
      setCacheValue(leagueScoresCache, cacheKey, sortedScores, LEAGUE_SCORES_CACHE_TTL_MS)
    }
    return sortedScores
  })()

  leagueScoresInflight.set(cacheKey, request)
  try {
    return await request
  } finally {
    leagueScoresInflight.delete(cacheKey)
  }
}

export function resetSportsApiCacheForTests(): void {
  badgeCache.clear()
  badgeInflight.clear()
  lastGameCache.clear()
  lastGameInflight.clear()
  leagueScoresCache.clear()
  leagueScoresInflight.clear()
  queuedSportsApiRequests.splice(0, queuedSportsApiRequests.length)
  activeSportsApiRequests = 0
}
