import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSpotifyAccountSnapshot } from '../spotifyApi'
import * as spotifyAuth from '../spotifyAuth'

vi.mock('../spotifyAuth', () => ({
  getValidSpotifyAuth: vi.fn(),
}))

describe('fetchSpotifyAccountSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the Spotify profile and playback state', async () => {
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'dayboard',
          display_name: 'Dayboard',
          images: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          device: null,
          is_playing: false,
          progress_ms: null,
          item: null,
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await fetchSpotifyAccountSnapshot({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    expect(snapshot.profile.display_name).toBe('Dayboard')
    expect(snapshot.playback).toEqual({
      device: null,
      is_playing: false,
      progress_ms: null,
      item: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.spotify.com/v1/me')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.spotify.com/v1/me/player')
    vi.unstubAllGlobals()
  })
})
