const SPOTIFY_EMBED_TYPES = new Set([
  'track',
  'album',
  'playlist',
  'artist',
  'episode',
  'show',
])

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

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const [firstSegment, secondSegment, thirdSegment] = segments
  const type = firstSegment === 'embed' ? secondSegment : firstSegment
  const id = firstSegment === 'embed' ? thirdSegment : secondSegment

  if (!type || !id || !SPOTIFY_EMBED_TYPES.has(type)) {
    return null
  }

  return `https://open.spotify.com/embed/${type}/${id}`
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
