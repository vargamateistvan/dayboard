import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SportsScoresWidget } from '../SportsScoresWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { resetSportsApiCacheForTests } from '../../lib/sports'

// Vitest runs in Node; the app's tsconfig has no Node types.
declare const process: { env: Record<string, string | undefined> }

function leagueEvent(overrides: Record<string, unknown> = {}) {
  return {
    idEvent: 'e1',
    strHomeTeam: 'Arsenal',
    strAwayTeam: 'Chelsea',
    intHomeScore: '2',
    intAwayScore: '1',
    strStatus: 'Match Finished',
    dateEvent: '2026-10-10',
    ...overrides,
  }
}

function respond(body: unknown, status = 200) {
  return { ok: status === 200, status, headers: { get: () => null }, json: async () => body }
}

function renderSports() {
  saveSettings({ ...DEFAULT_SETTINGS, sportsFavoriteTeams: [], sportsFollowedLeagues: ['EPL'] })
  return render(
    <SettingsProvider>
      <SportsScoresWidget />
    </SettingsProvider>,
  )
}

describe('SportsScoresWidget behaviour', () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    // West of UTC, a date-only event used to show as the previous day.
    process.env.TZ = 'America/Los_Angeles'
  })

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  beforeEach(() => {
    localStorage.clear()
    resetSportsApiCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    resetSportsApiCacheForTests()
  })

  it('shows a date-only result on its own date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('eventspastleague') ? respond({ events: [leagueEvent()] }) : respond({ teams: [] }),
      ),
    )
    renderSports()

    expect(await screen.findByText('Oct 10, 2026')).toBeInTheDocument()
  })

  it('labels a suspended game as suspended, not as a final result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('eventspastleague')
          ? respond({ events: [leagueEvent({ strStatus: 'Suspended' })] })
          : respond({ teams: [] }),
      ),
    )
    renderSports()

    expect(await screen.findByText('Suspended')).toBeInTheDocument()
    expect(screen.queryByText('Final')).not.toBeInTheDocument()
    expect(screen.queryByText('PEN')).not.toBeInTheDocument()
  })

  it('does not claim it updated when every request failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond({}, 500)))
    renderSports()

    await waitFor(() => expect(screen.getByText('Could not load league scores.')).toBeInTheDocument())
    expect(screen.queryByText(/Updated just now/)).not.toBeInTheDocument()
  })

  it('keeps league scores on screen when a refresh fails', async () => {
    let leagueCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (!String(input).includes('eventspastleague')) return respond({ teams: [] })
        leagueCalls += 1
        return leagueCalls === 1 ? respond({ events: [leagueEvent()] }) : respond({}, 500)
      }),
    )
    renderSports()
    expect(await screen.findByText('Arsenal')).toBeInTheDocument()

    resetSportsApiCacheForTests()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => expect(leagueCalls).toBeGreaterThan(1))
    await waitFor(() => expect(screen.getByText(/couldn.t refresh/i)).toBeInTheDocument())
    expect(screen.getByText('Arsenal')).toBeInTheDocument()
  })
})
