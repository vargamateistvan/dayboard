import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeSpotifyAuth } from '../initializeSpotifyAuth'
import * as spotifyAuth from '../lib/spotifyAuth'

vi.mock('../lib/spotifyAuth', () => ({
  completeSpotifyLoginFromUrl: vi.fn(),
  setSpotifyAuthNotice: vi.fn(),
}))

describe('initializeSpotifyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores a success notice when Spotify callback completes', async () => {
    vi.mocked(spotifyAuth.completeSpotifyLoginFromUrl).mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })

    await initializeSpotifyAuth()

    expect(spotifyAuth.setSpotifyAuthNotice).toHaveBeenCalledWith({
      type: 'success',
      message: 'Spotify connected successfully.',
    })
  })

  it('stores an error notice when Spotify callback handling fails', async () => {
    const error = new Error('Spotify login failed: access_denied')
    vi.mocked(spotifyAuth.completeSpotifyLoginFromUrl).mockRejectedValue(error)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await initializeSpotifyAuth()

    expect(spotifyAuth.setSpotifyAuthNotice).toHaveBeenCalledWith({
      type: 'error',
      message: 'Spotify login failed: access_denied',
    })

    consoleErrorSpy.mockRestore()
  })
})
