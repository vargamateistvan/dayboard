import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchSportsTeams } from '../sports'

describe('searchSportsTeams', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
