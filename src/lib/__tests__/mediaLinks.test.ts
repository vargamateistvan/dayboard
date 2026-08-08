import { describe, expect, it } from 'vitest'
import {
  createSavedMediaLink,
  formatSavedLinkLabel,
  normalizeSavedMediaLinks,
} from '../mediaLinks'

describe('media links', () => {
  it('normalizes saved links as url/title entries', () => {
    expect(
      normalizeSavedMediaLinks([
        'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        { url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475', title: '1989' },
      ]),
    ).toEqual([
      { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', title: 'Spotify Track' },
      { url: 'https://music.apple.com/us/album/1989/1440935467?i=1440935475', title: '1989' },
    ])
  })

  it('formats saved link labels from stored titles', () => {
    expect(formatSavedLinkLabel(createSavedMediaLink('https://example.com', 'My Title'))).toBe('My Title')
  })
})
