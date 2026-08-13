import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSpotifyAccountSnapshot, searchSpotifyCatalog } from '../spotifyApi'
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              played_at: '2026-08-13T10:00:00.000Z',
              track: {
                type: 'track',
                name: 'Dreams',
                artists: [{ name: 'Fleetwood Mac' }],
                album: {
                  name: 'Rumours',
                  images: [],
                },
                external_urls: {
                  spotify: 'https://open.spotify.com/track/example',
                },
              },
            },
          ],
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
    expect(snapshot.recentlyPlayed).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.spotify.com/v1/me')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.spotify.com/v1/me/player')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/me/player/recently-played?limit=3')
    vi.unstubAllGlobals()
  })
})

describe('searchSpotifyCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches tracks, albums, and playlists', async () => {
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: {
          items: [
            {
              type: 'track',
              name: 'Dreams',
              artists: [{ name: 'Fleetwood Mac' }],
              album: {
                name: 'Rumours',
                images: [],
              },
              external_urls: {
                spotify: 'https://open.spotify.com/track/example',
              },
            },
          ],
        },
        albums: {
          items: [],
        },
        playlists: {
          items: [],
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const results = await searchSpotifyCatalog(
      {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 60_000,
      },
      'dreams',
    )

    expect(results.tracks).toHaveLength(1)
    expect(results.tracks[0]?.name).toBe('Dreams')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/search?')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('q=dreams')
    vi.unstubAllGlobals()
  })
})
