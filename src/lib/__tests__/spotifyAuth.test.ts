import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forceRefreshSpotifyAuth,
  getStoredSpotifyAuth,
  getValidSpotifyAuth,
  SpotifySessionExpiredError,
  type SpotifyAuthSession,
} from '../spotifyAuth'

const KEY = 'dayboard_spotify_auth'

function storeExpiredAuth(): SpotifyAuthSession {
  const auth = { accessToken: 'old', refreshToken: 'refresh-1', expiresAt: Date.now() - 1_000 }
  localStorage.setItem(KEY, JSON.stringify(auth))
  return auth
}

function tokenResponse(status: number, body: unknown = {}) {
  return { ok: status === 200, status, json: async () => body }
}

describe('Spotify token refresh', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client')
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('signs out when Spotify rejects the refresh token', async () => {
    const auth = storeExpiredAuth()
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse(400, { error: 'invalid_grant' })))

    await expect(getValidSpotifyAuth(auth)).rejects.toBeInstanceOf(SpotifySessionExpiredError)
    expect(getStoredSpotifyAuth()).toBeNull()
  })

  it('stays signed in when the token endpoint has a temporary problem', async () => {
    const auth = storeExpiredAuth()
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse(503)))

    await expect(getValidSpotifyAuth(auth)).rejects.not.toBeInstanceOf(SpotifySessionExpiredError)
    expect(getStoredSpotifyAuth()).not.toBeNull()
  })

  it('sends one refresh request for concurrent callers', async () => {
    const auth = storeExpiredAuth()
    const fetchMock = vi.fn(async () =>
      tokenResponse(200, { access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 3600 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([getValidSpotifyAuth(auth), getValidSpotifyAuth(auth)])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.accessToken).toBe('fresh')
    expect(second.accessToken).toBe('fresh')
  })

  it('can force a refresh for a token Spotify rejected before its expiry time', async () => {
    const auth = { accessToken: 'revoked', refreshToken: 'refresh-1', expiresAt: Date.now() + 3_600_000 }
    localStorage.setItem(KEY, JSON.stringify(auth))
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse(200, { access_token: 'fresh', expires_in: 3600 })))

    expect((await forceRefreshSpotifyAuth(auth)).accessToken).toBe('fresh')
  })
})
