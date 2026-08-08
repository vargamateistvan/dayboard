import { describe, expect, it } from 'vitest'
import { normalizeAppleMusicEmbedUrl, normalizeSpotifyEmbedUrl } from '../musicEmbeds'

describe('normalizeSpotifyEmbedUrl', () => {
  it('converts spotify share urls to embed urls', () => {
    expect(
      normalizeSpotifyEmbedUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123'),
    ).toBe('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')
  })

  it('keeps spotify embed urls normalized', () => {
    expect(
      normalizeSpotifyEmbedUrl('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'),
    ).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')
  })

  it('rejects non spotify urls', () => {
    expect(normalizeSpotifyEmbedUrl('https://example.com/song')).toBeNull()
  })
})

describe('normalizeAppleMusicEmbedUrl', () => {
  it('converts apple music share urls to embed urls', () => {
    expect(
      normalizeAppleMusicEmbedUrl('https://music.apple.com/us/album/1989/1440935467?i=1440935475'),
    ).toBe('https://embed.music.apple.com/us/album/1989/1440935467?i=1440935475')
  })

  it('keeps existing apple embed urls', () => {
    expect(
      normalizeAppleMusicEmbedUrl('https://embed.music.apple.com/us/playlist/pl.u-V9D7vJ7uBEXJp'),
    ).toBe('https://embed.music.apple.com/us/playlist/pl.u-V9D7vJ7uBEXJp')
  })

  it('rejects non apple music urls', () => {
    expect(normalizeAppleMusicEmbedUrl('https://spotify.com/track/123')).toBeNull()
  })
})
