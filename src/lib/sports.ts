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

export interface SportsTeamSearchResult extends SportsFavoriteTeam {}

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
  status: 'FT' | 'AET' | 'PEN'
}

const SPORTS_DB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3'

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
    const leagueIdMatch = (
      (league.id === 'EPL' && leagueIdFromTeam === '4328') ||
      (league.id === 'LALIGA' && leagueIdFromTeam === '4335') ||
      (league.id === 'SERIE_A' && leagueIdFromTeam === '4332') ||
      (league.id === 'BUNDESLIGA' && leagueIdFromTeam === '4331') ||
      (league.id === 'LIGUE_1' && leagueIdFromTeam === '4334') ||
      (league.id === 'EREDIVISIE' && leagueIdFromTeam === '4337') ||
      (league.id === 'PRIMEIRA_LIGA' && leagueIdFromTeam === '4344') ||
      (league.id === 'NBA' && leagueIdFromTeam === '4387') ||
      (league.id === 'NFL' && leagueIdFromTeam === '4391') ||
      (league.id === 'MLB' && leagueIdFromTeam === '4424') ||
      (league.id === 'NHL' && leagueIdFromTeam === '4380')
    )
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

export async function searchSportsTeams(
  query: string,
  enabledLeagues: SportsLeagueId[],
): Promise<SportsTeamSearchResult[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) {
    return []
  }

  const response = await fetch(
    `${SPORTS_DB_BASE_URL}/searchteams.php?t=${encodeURIComponent(trimmedQuery)}`,
  )

  if (!response.ok) {
    throw new Error('Could not load teams.')
  }

  const data = await response.json() as { teams?: SportsDbTeam[] | null }
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
        const fallbackResponse = await fetch(
          `${SPORTS_DB_BASE_URL}/search_all_teams.php?l=${encodeURIComponent(league.providerLeagueName)}`,
        )

        if (!fallbackResponse.ok) {
          return [] as SportsTeamSearchResult[]
        }

        const fallbackData = await fallbackResponse.json() as { teams?: SportsDbTeam[] | null }
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

function parseEventStatus(rawStatus: unknown): 'FT' | 'AET' | 'PEN' {
  if (typeof rawStatus !== 'string') {
    return 'FT'
  }

  const normalized = rawStatus.toLowerCase()
  if (normalized.includes('pen')) {
    return 'PEN'
  }
  if (normalized.includes('extra')) {
    return 'AET'
  }
  return 'FT'
}

async function fetchTeamBadgeUrl(teamId: string): Promise<string | undefined> {
  const response = await fetch(
    `${SPORTS_DB_BASE_URL}/lookupteam.php?id=${encodeURIComponent(teamId)}`,
  )

  if (!response.ok) {
    throw new Error('Could not load team logo.')
  }

  const data = await response.json() as { teams?: SportsDbTeam[] | null }
  const firstTeam = Array.isArray(data.teams) ? data.teams[0] : null
  if (!firstTeam) {
    return undefined
  }

  return pickTeamBadge(firstTeam)
}

export async function fetchLastGameForTeam(team: SportsFavoriteTeam): Promise<SportsLastGame> {
  const response = await fetch(
    `${SPORTS_DB_BASE_URL}/eventslast.php?id=${encodeURIComponent(team.id)}`,
  )

  if (!response.ok) {
    throw new Error('Could not load last game.')
  }

  const data = await response.json() as { results?: SportsDbEvent[] | null }
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
  const playedAt = typeof completedEvent.strTimestamp === 'string' && completedEvent.strTimestamp.length > 0
    ? completedEvent.strTimestamp
    : `${completedEvent.dateEvent ?? ''}T00:00:00Z`

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

  return {
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
}
