import { describe, expect, it, vi } from 'vitest'
import {
  createSavedMediaLink,
  formatSavedLinkLabel,
  normalizeSavedMediaLinks,
  resolveMediaLinkTitle,
} from '../mediaLinks'

describe('media links', () => {
  it('normalizes saved links as url/title entries', () => {
    expect(
      normalizeSavedMediaLinks([
        'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        { url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475', title: '1989' },
      ]),
    ).toEqual([
      { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', title: 'Track' },
      { url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475', title: '1989' },
    ])
  })

  it('formats saved link labels from stored titles', () => {
    expect(formatSavedLinkLabel(createSavedMediaLink('https://example.com', 'My Title'))).toBe('My Title')
  })

  it('resolves Spotify titles from oEmbed metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Taylor Swift - Lover' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveMediaLinkTitle('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'),
    ).resolves.toBe('Taylor Swift - Lover')

    vi.unstubAllGlobals()
  })

  it('falls back to local title when Spotify metadata lookup fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveMediaLinkTitle('https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02'),
    ).resolves.toBe('Artist')

    vi.unstubAllGlobals()
  })
})
