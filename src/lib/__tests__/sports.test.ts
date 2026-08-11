import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchLastGameForTeam, fetchRecentLeagueScores, resetSportsApiCacheForTests, searchSportsTeams } from '../sports'
import type { SportsFavoriteTeam } from '../settings'

describe('searchSportsTeams', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetSportsApiCacheForTests()
  })

  it('falls back to enabled league team lists when direct team search is sparse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        // searchteams.php
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ teams: [] }),
        })
        // EPL search_all_teams.php
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: [
              {
                idTeam: '133604',
                strTeam: 'Arsenal',
                strTeamAlternate: 'Arsenal Football Club',
                strBadge: 'https://images.example.com/arsenal.png',
              },
              {
                idTeam: '133602',
                strTeam: 'Chelsea',
                strTeamAlternate: 'Chelsea Football Club',
                strBadge: 'https://images.example.com/chelsea.png',
              },
            ],
          }),
        }),
    )

    const results = await searchSportsTeams('ars', ['EPL'])
    expect(results).toEqual([
      expect.objectContaining({
        id: '133604',
        name: 'Arsenal',
        leagueId: 'EPL',
        leagueName: 'Premier League',
        badgeUrl: 'https://images.example.com/arsenal.png',
      }),
    ])
  })

  it('deduplicates teams between direct and fallback sources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        // searchteams.php
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: [
              {
                idTeam: '133604',
                strTeam: 'Arsenal',
                strLeague: 'English Premier League',
                strSport: 'Soccer',
                strBadge: 'https://images.example.com/arsenal.png',
              },
            ],
          }),
        })
        // EPL search_all_teams.php
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: [
              {
                idTeam: '133604',
                strTeam: 'Arsenal',
                strTeamAlternate: 'Arsenal Football Club',
                strBadge: 'https://images.example.com/arsenal.png',
              },
            ],
          }),
        }),
    )

    const results = await searchSportsTeams('arsenal', ['EPL'])
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual(
      expect.objectContaining({
        id: '133604',
        name: 'Arsenal',
      }),
    )
  })
})

describe('fetchRecentLeagueScores', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetSportsApiCacheForTests()
  })

  it('maps completed league events into score rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              idEvent: 'e1',
              strHomeTeam: 'Arsenal',
              strAwayTeam: 'Chelsea',
              intHomeScore: '2',
              intAwayScore: '1',
              strStatus: 'Match Finished',
              strTimestamp: '2026-08-10T16:30:00+00:00',
            },
            {
              idEvent: 'e2',
              strHomeTeam: 'Team A',
              strAwayTeam: 'Team B',
              intHomeScore: null,
              intAwayScore: null,
            },
          ],
        }),
      }),
    )

    const results = await fetchRecentLeagueScores(['EPL'])
    expect(results).toEqual([
      expect.objectContaining({
        id: 'e1',
        leagueId: 'EPL',
        leagueName: 'Premier League',
        homeTeamName: 'Arsenal',
        awayTeamName: 'Chelsea',
        homeScore: 2,
        awayScore: 1,
        status: 'FT',
      }),
    ])
  })

  it('reuses cached league scores within ttl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            idEvent: 'e1',
            strHomeTeam: 'Arsenal',
            strAwayTeam: 'Chelsea',
            intHomeScore: '2',
            intAwayScore: '1',
            strStatus: 'Match Finished',
            strTimestamp: '2026-08-10T16:30:00+00:00',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchRecentLeagueScores(['EPL'])
    await fetchRecentLeagueScores(['EPL'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetchLastGameForTeam', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetSportsApiCacheForTests()
  })

  it('reuses cached team game and badge requests within ttl', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              idHomeTeam: '133604',
              idAwayTeam: '133602',
              strHomeTeam: 'Arsenal',
              strAwayTeam: 'Chelsea',
              intHomeScore: '2',
              intAwayScore: '1',
              strStatus: 'Match Finished',
              strTimestamp: '2026-08-10T16:30:00+00:00',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: [{ idTeam: '133604', strBadge: 'https://images.example.com/arsenal.png' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teams: [{ idTeam: '133602', strBadge: 'https://images.example.com/chelsea.png' }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const team: SportsFavoriteTeam = {
      id: '133604',
      name: 'Arsenal',
      leagueId: 'EPL',
      leagueName: 'Premier League',
      sport: 'soccer',
    }

    await fetchLastGameForTeam(team)
    await fetchLastGameForTeam(team)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
