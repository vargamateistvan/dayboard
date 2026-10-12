import { describe, expect, it } from 'vitest'
import { normalizeSpotifyEmbedUrl, normalizeSpotifyPodcastEmbedUrl, parseSpotifyPath } from '../musicEmbeds'
import { createSavedMediaLink } from '../mediaLinks'
import { spotifyUrlToPlayRequest } from '../spotifyApi'

const ID = '4uLU6hMCjMI75M1A2tKUQC'

describe('Spotify links with a locale prefix', () => {
  it.each([
    [`https://open.spotify.com/intl-de/track/${ID}`, { type: 'track', id: ID }],
    [`https://open.spotify.com/intl-pt-BR/album/${ID}?si=abc`, { type: 'album', id: ID }],
    [`https://open.spotify.com/embed/playlist/${ID}`, { type: 'playlist', id: ID }],
    [`https://open.spotify.com/track/${ID}`, { type: 'track', id: ID }],
  ])('parses %s', (link, expected) => {
    expect(parseSpotifyPath(new URL(link))).toEqual(expected)
  })

  it('rejects ids that are not Spotify ids', () => {
    expect(parseSpotifyPath(new URL('https://open.spotify.com/track/not-an-id'))).toBeNull()
  })

  it('embeds locale-prefixed tracks and shows', () => {
    expect(normalizeSpotifyEmbedUrl(`https://open.spotify.com/intl-de/track/${ID}`)).toBe(
      `https://open.spotify.com/embed/track/${ID}`,
    )
    expect(normalizeSpotifyPodcastEmbedUrl(`https://open.spotify.com/intl-fr/show/${ID}`)).toBe(
      `https://open.spotify.com/embed/show/${ID}`,
    )
  })

  it('labels a locale-prefixed saved link by its type', () => {
    expect(createSavedMediaLink(`https://open.spotify.com/intl-de/album/${ID}`)?.title).toMatch(/Album/)
  })

  it('builds a play request from a locale-prefixed link', () => {
    expect(spotifyUrlToPlayRequest(`https://open.spotify.com/intl-de/track/${ID}`)).toEqual({ uris: [`spotify:track:${ID}`] })
  })
})
