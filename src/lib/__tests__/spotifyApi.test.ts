import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchSpotifyAccountSnapshot,
  pauseSpotifyPlayback,
  resumeSpotifyPlayback,
  searchSpotifyCatalog,
  setSpotifyPlaybackVolume,
  skipToNextSpotifyTrack,
  skipToPreviousSpotifyTrack,
  spotifyUrlToPlayRequest,
  startSpotifyPlayback,
  transferSpotifyPlayback,
} from '../spotifyApi'
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
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
    expect(snapshot.library).toEqual({
      topArtists: [],
      topTracks: [],
      savedAlbums: [],
      playlists: [],
    })
    expect(fetchMock).toHaveBeenCalledTimes(7)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.spotify.com/v1/me')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.spotify.com/v1/me/player')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/me/player/recently-played?limit=3')
    vi.unstubAllGlobals()
  })

  it('skips repeated forbidden library requests for the same token', async () => {
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue({
      accessToken: 'token-with-limited-scopes',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'dayboard', display_name: 'Dayboard', images: [] }),
        }
      }
      if (url.endsWith('/me/player')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ device: null, is_playing: false, progress_ms: null, item: null }),
        }
      }
      if (url.includes('/me/player/recently-played?limit=3')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        }
      }
      if (
        url.includes('/me/top/artists?limit=5') ||
        url.includes('/me/top/tracks?limit=5') ||
        url.includes('/me/albums?limit=5') ||
        url.includes('/me/playlists?limit=5')
      ) {
        return {
          ok: false,
          status: 403,
          json: async () => ({}),
        }
      }

      throw new Error(`Unhandled request in test: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    await fetchSpotifyAccountSnapshot({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })
    await fetchSpotifyAccountSnapshot({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    expect(fetchMock).toHaveBeenCalledTimes(10)
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(requestedUrls.filter((url) => url.includes('/me/top/artists?limit=5'))).toHaveLength(1)
    expect(requestedUrls.filter((url) => url.includes('/me/top/tracks?limit=5'))).toHaveLength(1)
    expect(requestedUrls.filter((url) => url.includes('/me/albums?limit=5'))).toHaveLength(1)
    expect(requestedUrls.filter((url) => url.includes('/me/playlists?limit=5'))).toHaveLength(1)
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

describe('playback controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends pause/play/next/previous commands to Spotify', async () => {
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    }

    await skipToPreviousSpotifyTrack(auth)
    await resumeSpotifyPlayback(auth)
    await pauseSpotifyPlayback(auth)
    await skipToNextSpotifyTrack(auth)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.spotify.com/v1/me/player/previous')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.spotify.com/v1/me/player/play')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.spotify.com/v1/me/player/pause')
    expect(fetchMock.mock.calls[3]?.[0]).toBe('https://api.spotify.com/v1/me/player/next')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' })
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'PUT' })
    vi.unstubAllGlobals()
  })
})

describe('spotifyUrlToPlayRequest', () => {
  it('converts track URLs and URIs to a uris request', () => {
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/track/abc123')).toEqual({
      uris: ['spotify:track:abc123'],
    })
    expect(spotifyUrlToPlayRequest('spotify:track:abc123')).toEqual({
      uris: ['spotify:track:abc123'],
    })
  })

  it('converts album, playlist, and artist URLs to a context_uri request', () => {
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/album/alb1')).toEqual({
      context_uri: 'spotify:album:alb1',
    })
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/playlist/pl1?si=x')).toEqual({
      context_uri: 'spotify:playlist:pl1',
    })
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/artist/art1')).toEqual({
      context_uri: 'spotify:artist:art1',
    })
  })

  it('handles embed URLs', () => {
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/embed/track/xyz')).toEqual({
      uris: ['spotify:track:xyz'],
    })
  })

  it('returns null for empty or unsupported values', () => {
    expect(spotifyUrlToPlayRequest('')).toBeNull()
    expect(spotifyUrlToPlayRequest('https://example.com/track/abc')).toBeNull()
    expect(spotifyUrlToPlayRequest('https://open.spotify.com/user/someone')).toBeNull()
  })
})

describe('web playback commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('transfers playback, starts a context, and sets volume on a device', async () => {
    vi.mocked(spotifyAuth.getValidSpotifyAuth).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    }

    await transferSpotifyPlayback(auth, 'device-1', true)
    await startSpotifyPlayback(auth, 'device-1', { context_uri: 'spotify:album:alb1' })
    await setSpotifyPlaybackVolume(auth, 42, 'device-1')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.spotify.com/v1/me/player')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      device_ids: ['device-1'],
      play: true,
    })

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.spotify.com/v1/me/player/play?device_id=device-1',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      context_uri: 'spotify:album:alb1',
    })

    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.spotify.com/v1/me/player/volume?volume_percent=42&device_id=device-1',
    )
    vi.unstubAllGlobals()
  })
})
