export interface SavedMediaLink {
  url: string
  title: string
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function titleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

function getSpotifyTypeLabel(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean)
  const type = segments[0] === 'embed' ? segments[1] : segments[0]
  switch (type) {
    case 'track':
      return 'Spotify Track'
    case 'album':
      return 'Spotify Album'
    case 'playlist':
      return 'Spotify Playlist'
    case 'artist':
      return 'Spotify Artist'
    case 'show':
      return 'Spotify Podcast'
    case 'episode':
      return 'Spotify Episode'
    default:
      return 'Spotify Link'
  }
}

function getFallbackTitle(url: string): string {
  const parsed = parseHttpUrl(url)
  if (!parsed) return url

  if (parsed.hostname === 'open.spotify.com') {
    return getSpotifyTypeLabel(parsed)
  }

  if (['music.apple.com', 'podcasts.apple.com', 'embed.music.apple.com', 'embed.podcasts.apple.com'].includes(parsed.hostname)) {
    const segments = parsed.pathname.split('/').filter(Boolean)
    const hasLocalePrefix = /^[a-z]{2}$/i.test(segments[0] ?? '')
    const slugIndex = hasLocalePrefix ? 2 : 1
    const slug =
      segments[slugIndex] ??
      segments[slugIndex + 1] ??
      segments.find((segment) => !/^\d+$/.test(segment) && !segment.startsWith('pl.')) ??
      ''
    const prefix = parsed.hostname.includes('podcasts') ? 'Apple Podcast' : 'Apple Music'
    const suffix = titleCaseFromSlug(slug)
    return suffix ? `${prefix} ${suffix}` : `${prefix} Link`
  }

  return parsed.hostname.replace(/^www\./, '')
}

function normalizeTitle(title: unknown, url: string): string {
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return getFallbackTitle(url)
}

function normalizeEntry(value: unknown): SavedMediaLink | null {
  if (typeof value === 'string') {
    const url = value.trim()
    return url ? { url, title: getFallbackTitle(url) } : null
  }

  if (!value || typeof value !== 'object') return null
  const candidate = value as { url?: unknown; title?: unknown }
  if (typeof candidate.url !== 'string') return null
  const url = candidate.url.trim()
  if (!url) return null
  return { url, title: normalizeTitle(candidate.title, url) }
}

export function normalizeSavedMediaLinks(values: unknown, fallbackEntry?: unknown): SavedMediaLink[] {
  const list = Array.isArray(values) ? values : []
  const normalized: SavedMediaLink[] = []
  const seen = new Set<string>()

  const append = (value: unknown) => {
    const entry = normalizeEntry(value)
    if (!entry || seen.has(entry.url)) return
    seen.add(entry.url)
    normalized.push(entry)
  }

  list.forEach(append)
  append(fallbackEntry)

  return normalized
}

export function createSavedMediaLink(url: string, title?: string | null): SavedMediaLink {
  return {
    url: url.trim(),
    title: normalizeTitle(title ?? undefined, url),
  }
}

export function formatSavedLinkLabel(entry: SavedMediaLink): string {
  return truncate(entry.title || getFallbackTitle(entry.url), 42)
}

export function resolveMediaLinkTitle(url: string): string {
  return getFallbackTitle(url)
}

export function removeSavedMediaLink(links: SavedMediaLink[], url: string): SavedMediaLink[] {
  return links.filter((link) => link.url !== url)
}
