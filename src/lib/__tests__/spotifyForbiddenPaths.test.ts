import { afterEach, describe, expect, it } from 'vitest'
import {
  addSpotifyForbiddenPath,
  clearSpotifyForbiddenPaths,
  readSpotifyForbiddenPaths,
} from '../spotifyForbiddenPaths'
import { clearStoredSpotifyAuth } from '../spotifyAuth'

const LEGACY_KEY = 'dayboard_spotify_forbidden_optional_paths_v1'

describe('spotifyForbiddenPaths', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('remembers forbidden paths without storing any token', () => {
    addSpotifyForbiddenPath('/me/albums?limit=5')
    addSpotifyForbiddenPath('/me/albums?limit=5')
    addSpotifyForbiddenPath('/me/shows?limit=5')

    expect([...readSpotifyForbiddenPaths()]).toEqual(['/me/albums?limit=5', '/me/shows?limit=5'])
    const everything = JSON.stringify({ ...localStorage })
    expect(everything).not.toMatch(/refresh/i)
  })

  it('removes the legacy cache that was keyed by refresh token', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ 'secret-refresh-token': ['/me/albums?limit=5'] }))

    readSpotifyForbiddenPaths()

    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('is cleared on disconnect', () => {
    addSpotifyForbiddenPath('/me/albums?limit=5')
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ 'secret-refresh-token': [] }))

    clearStoredSpotifyAuth()

    expect(readSpotifyForbiddenPaths().size).toBe(0)
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('can be cleared directly', () => {
    addSpotifyForbiddenPath('/me/albums?limit=5')
    clearSpotifyForbiddenPaths()
    expect(readSpotifyForbiddenPaths().size).toBe(0)
  })
})
