const ITUNES_SEARCH_ENDPOINT = 'https://itunes.apple.com/search'

export interface AppleCatalogItem {
  readonly url: string
  readonly title: string
  readonly subtitle: string
  readonly artworkUrl?: string
}

export interface AppleMusicSearchResults {
  readonly songs: AppleCatalogItem[]
  readonly albums: AppleCatalogItem[]
  readonly artists: AppleCatalogItem[]
}

export interface ApplePodcastSearchResults {
  readonly shows: AppleCatalogItem[]
  readonly episodes: AppleCatalogItem[]
}

interface ItunesResult {
  readonly wrapperType?: string
  readonly kind?: string
  readonly trackName?: string
  readonly collectionName?: string
  readonly artistName?: string
  readonly primaryGenreName?: string
  readonly trackViewUrl?: string
  readonly collectionViewUrl?: string
  readonly artistLinkUrl?: string
  readonly artworkUrl60?: string
  readonly artworkUrl100?: string
  readonly artworkUrl160?: string
  readonly artworkUrl600?: string
}

function cleanAppleUrl(value: string | undefined, allowedHosts: string[]): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (!allowedHosts.includes(url.hostname)) {
      return null
    }
    // Drop iTunes affiliate/tracking params; keep meaningful ones like `i`.
    url.searchParams.delete('uo')
    url.searchParams.delete('mt')
    return url.toString()
  } catch {
    return null
  }
}

function pickArtwork(result: ItunesResult): string | undefined {
  return (
    result.artworkUrl160 ??
    result.artworkUrl100 ??
    result.artworkUrl60 ??
    result.artworkUrl600 ??
    undefined
  )
}

async function fetchItunesResults(params: Record<string, string>): Promise<ItunesResult[]> {
  const url = new URL(ITUNES_SEARCH_ENDPOINT)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Apple catalog search failed (${response.status}).`)
  }

  const data = (await response.json()) as { results?: unknown }
  return Array.isArray(data.results) ? (data.results as ItunesResult[]) : []
}

function toSong(result: ItunesResult): AppleCatalogItem | null {
  const url = cleanAppleUrl(result.trackViewUrl, ['music.apple.com'])
  if (!url || !result.trackName) {
    return null
  }
  return {
    url,
    title: result.trackName,
    subtitle: result.artistName ?? 'Song',
    artworkUrl: pickArtwork(result),
  }
}

function toAlbum(result: ItunesResult): AppleCatalogItem | null {
  const url = cleanAppleUrl(result.collectionViewUrl, ['music.apple.com'])
  if (!url || !result.collectionName) {
    return null
  }
  return {
    url,
    title: result.collectionName,
    subtitle: result.artistName ?? 'Album',
    artworkUrl: pickArtwork(result),
  }
}

function toArtist(result: ItunesResult): AppleCatalogItem | null {
  const url = cleanAppleUrl(result.artistLinkUrl, ['music.apple.com'])
  if (!url || !result.artistName) {
    return null
  }
  return {
    url,
    title: result.artistName,
    subtitle: result.primaryGenreName ?? 'Artist',
    artworkUrl: pickArtwork(result),
  }
}

function toShow(result: ItunesResult): AppleCatalogItem | null {
  const url = cleanAppleUrl(result.collectionViewUrl ?? result.trackViewUrl, [
    'podcasts.apple.com',
  ])
  if (!url || !(result.collectionName ?? result.trackName)) {
    return null
  }
  return {
    url,
    title: result.collectionName ?? result.trackName ?? 'Podcast',
    subtitle: result.artistName ?? 'Podcast',
    artworkUrl: pickArtwork(result),
  }
}

function toEpisode(result: ItunesResult): AppleCatalogItem | null {
  const url = cleanAppleUrl(result.trackViewUrl, ['podcasts.apple.com'])
  if (!url || !result.trackName) {
    return null
  }
  return {
    url,
    title: result.trackName,
    subtitle: result.collectionName ?? 'Episode',
    artworkUrl: pickArtwork(result),
  }
}

function mapResults(
  results: ItunesResult[],
  map: (result: ItunesResult) => AppleCatalogItem | null,
): AppleCatalogItem[] {
  const items: AppleCatalogItem[] = []
  const seen = new Set<string>()
  for (const result of results) {
    const item = map(result)
    if (item && !seen.has(item.url)) {
      seen.add(item.url)
      items.push(item)
    }
  }
  return items
}

export async function searchAppleMusicCatalog(query: string): Promise<AppleMusicSearchResults> {
  const term = query.trim()
  const [songs, albums, artists] = await Promise.all([
    fetchItunesResults({ term, media: 'music', entity: 'song', limit: '8' }),
    fetchItunesResults({ term, media: 'music', entity: 'album', limit: '6' }),
    fetchItunesResults({ term, media: 'music', entity: 'musicArtist', limit: '4' }),
  ])

  return {
    songs: mapResults(songs, toSong),
    albums: mapResults(albums, toAlbum),
    artists: mapResults(artists, toArtist),
  }
}

export async function searchApplePodcastCatalog(query: string): Promise<ApplePodcastSearchResults> {
  const term = query.trim()
  const [shows, episodes] = await Promise.all([
    fetchItunesResults({ term, media: 'podcast', entity: 'podcast', limit: '8' }),
    fetchItunesResults({ term, media: 'podcast', entity: 'podcastEpisode', limit: '8' }),
  ])

  return {
    shows: mapResults(shows, toShow),
    episodes: mapResults(episodes, toEpisode),
  }
}
