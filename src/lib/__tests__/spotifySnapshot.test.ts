import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSpotifyAccountSnapshot } from '../spotifyApi'
import * as spotifyAuth from '../spotifyAuth'

vi.mock('../spotifyAuth', () => ({
  getValidSpotifyAuth: vi.fn(),
  forceRefreshSpotifyAuth: vi.fn(),
}))

const AUTH = { accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 }

function respond(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body }
}

describe('fetchSpotifyAccountSnapshot resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue(AUTH)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the profile when an optional library request is rate-limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/me')) return respond(200, { id: 'me', display_name: 'Me', images: [] })
        if (url.includes('/me/albums')) return respond(429)
        return respond(200, { items: [] })
      }),
    )

    const snapshot = await fetchSpotifyAccountSnapshot(AUTH)

    expect(snapshot.profile.id).toBe('me')
    expect(snapshot.library?.savedAlbums).toEqual([])
  })

  it('does not request the unused playback state', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/me') ? respond(200, { id: 'me', images: [] }) : respond(200, { items: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchSpotifyAccountSnapshot(AUTH)

    expect(fetchMock.mock.calls.map(([url]) => String(url)).some((url) => url.endsWith('/me/player'))).toBe(false)
  })

  it('refreshes once and retries when Spotify rejects the access token', async () => {
    vi.mocked(spotifyAuth.forceRefreshSpotifyAuth).mockResolvedValue({ ...AUTH, accessToken: 'fresh' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const token = (init?.headers as Record<string, string>)?.Authorization
        if (String(input).endsWith('/me')) {
          return token === 'Bearer fresh' ? respond(200, { id: 'me', images: [] }) : respond(401)
        }
        return respond(200, { items: [] })
      }),
    )

    const snapshot = await fetchSpotifyAccountSnapshot(AUTH)

    expect(spotifyAuth.forceRefreshSpotifyAuth).toHaveBeenCalledTimes(1)
    expect(snapshot.profile.id).toBe('me')
  })
})
