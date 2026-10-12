const SPOTIFY_EMBED_TYPES = new Set([
  'track',
  'album',
  'playlist',
  'artist',
  'episode',
  'show',
])

const LOCALE_SEGMENT = /^intl-[a-z]{2}(?:-[a-z]{2,4})?$/i
const SPOTIFY_ID = /^[A-Za-z0-9]+$/

/**
 * Type and id from an open.spotify.com path, accepting the "/intl-de/" locale
 * prefix of current share links and the "/embed/" prefix of player links.
 */
export function parseSpotifyPath(url: URL): { type: string; id: string } | null {
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments[0] && LOCALE_SEGMENT.test(segments[0])) segments.shift()
  if (segments[0] === 'embed') segments.shift()

  const [type, id] = segments
  return type && id && SPOTIFY_ID.test(id) ? { type, id } : null
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url
  } catch {
    return null
  }
}

export function normalizeSpotifyEmbedUrl(value: string): string | null {
  const url = parseHttpUrl(value)
  if (!url || url.hostname !== 'open.spotify.com') {
    return null
  }

  const parsed = parseSpotifyPath(url)
  if (!parsed || !SPOTIFY_EMBED_TYPES.has(parsed.type)) {
    return null
  }

  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`
}

export function normalizeAppleMusicEmbedUrl(value: string): string | null {
  const url = parseHttpUrl(value)
  if (!url || !['music.apple.com', 'embed.music.apple.com'].includes(url.hostname)) {
    return null
  }

  if (url.pathname === '/' || url.pathname.trim() === '') {
    return null
  }

  return `https://embed.music.apple.com${url.pathname}${url.search}`
}

export function normalizeSpotifyPodcastEmbedUrl(value: string): string | null {
  const url = parseHttpUrl(value)
  if (!url || url.hostname !== 'open.spotify.com') {
    return null
  }

  const parsed = parseSpotifyPath(url)
  if (!parsed || !['show', 'episode'].includes(parsed.type)) {
    return null
  }

  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`
}

export function normalizeApplePodcastEmbedUrl(value: string): string | null {
  const url = parseHttpUrl(value)
  if (!url || !['podcasts.apple.com', 'embed.podcasts.apple.com'].includes(url.hostname)) {
    return null
  }

  if (url.pathname === '/' || url.pathname.trim() === '') {
    return null
  }

  return `https://embed.podcasts.apple.com${url.pathname}${url.search}`
}
