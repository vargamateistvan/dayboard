import { getValidSpotifyAuth, type SpotifyAuthSession } from './spotifyAuth'

export interface SpotifyProfile {
  id: string
  display_name: string | null
  images: Array<{ url: string; width?: number; height?: number }>
  /** Requires the `user-read-private` scope. `premium`, `free`, or `open`. */
  product?: string
}

export interface SpotifyPlaybackArtist {
  name: string
}

export interface SpotifyPlaybackDevice {
  id: string | null
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number | null
}

export interface SpotifyPlaybackTrack {
  type: 'track'
  name: string
  artists: SpotifyPlaybackArtist[]
  album: {
    name: string
    images: Array<{ url: string; width?: number; height?: number }>
  }
  external_urls: {
    spotify: string
  }
  duration_ms: number
}

export interface SpotifyPlaybackEpisode {
  type: 'episode'
  name: string
  show: {
    name: string
    publisher: string
  }
  external_urls: {
    spotify: string
  }
  duration_ms: number
}

export type SpotifyPlaybackItem = SpotifyPlaybackTrack | SpotifyPlaybackEpisode

export interface SpotifyPlaybackState {
  device: SpotifyPlaybackDevice | null
  is_playing: boolean
  progress_ms: number | null
  item: SpotifyPlaybackItem | null
}

export interface SpotifyRecentPlayedTrack {
  type: 'track'
  name: string
  artists: SpotifyPlaybackArtist[]
  album: {
    name: string
    images: Array<{ url: string; width?: number; height?: number }>
  }
  external_urls: {
    spotify: string
  }
}

export interface SpotifyRecentPlayedItem {
  played_at: string
  track: SpotifyRecentPlayedTrack | null
}

export interface SpotifySearchTrackItem {
  type: 'track'
  name: string
  artists: SpotifyPlaybackArtist[]
  album: {
    name: string
    images: Array<{ url: string; width?: number; height?: number }>
  }
  external_urls: {
    spotify: string
  }
}

export interface SpotifySearchAlbumItem {
  type: 'album'
  name: string
  artists: SpotifyPlaybackArtist[]
  images: Array<{ url: string; width?: number; height?: number }>
  external_urls: {
    spotify: string
  }
}

export interface SpotifySearchPlaylistItem {
  type: 'playlist'
  name: string
  owner: {
    display_name: string | null
  }
  images: Array<{ url: string; width?: number; height?: number }>
  external_urls: {
    spotify: string
  }
  tracks: {
    total: number
  }
}

export interface SpotifySearchShowItem {
  type: 'show'
  name: string
  publisher: string
  images: Array<{ url: string; width?: number; height?: number }>
  external_urls: {
    spotify: string
  }
}

export interface SpotifySearchEpisodeItem {
  type: 'episode'
  name: string
  release_date?: string
  images: Array<{ url: string; width?: number; height?: number }>
  external_urls: {
    spotify: string
  }
}

export interface SpotifyTopArtistItem {
  id: string
  name: string
  images: Array<{ url: string; width?: number; height?: number }>
  external_urls: {
    spotify: string
  }
}

export interface SpotifyTopTrackItem {
  name: string
  artists: SpotifyPlaybackArtist[]
  album: {
    name: string
    images: Array<{ url: string; width?: number; height?: number }>
  }
  external_urls: {
    spotify: string
  }
}

export interface SpotifySavedAlbumItem {
  album: {
    name: string
    artists: SpotifyPlaybackArtist[]
    images: Array<{ url: string; width?: number; height?: number }>
    external_urls: {
      spotify: string
    }
  }
}

export interface SpotifySavedShowItem {
  show: {
    name: string
    publisher: string
    images: Array<{ url: string; width?: number; height?: number }>
    external_urls: {
      spotify: string
    }
  }
}

export interface SpotifyLibrarySnapshot {
  topArtists: SpotifyTopArtistItem[]
  topTracks: SpotifyTopTrackItem[]
  savedAlbums: SpotifySavedAlbumItem[]
  savedShows: SpotifySavedShowItem[]
  playlists: SpotifySearchPlaylistItem[]
}

export interface SpotifySearchResults {
  tracks: SpotifySearchTrackItem[]
  albums: SpotifySearchAlbumItem[]
  playlists: SpotifySearchPlaylistItem[]
  shows: SpotifySearchShowItem[]
  episodes: SpotifySearchEpisodeItem[]
}

export interface SpotifyAccountSnapshot {
  profile: SpotifyProfile
  playback: SpotifyPlaybackState | null
  recentlyPlayed: SpotifyRecentPlayedItem[] | null
  library: SpotifyLibrarySnapshot | null
}

async function parseSpotifyError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: { message?: string } }
    const message = data.error?.message?.trim()
    if (message) {
      return message
    }
  } catch {
    // Ignore JSON parse errors and fall back to status text.
  }

  if (response.statusText) {
    return response.statusText
  }

  return 'Spotify request failed.'
}

async function fetchSpotifyJson<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 204) {
    throw new Error('Spotify request returned no content.')
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const retryAfterText =
      retryAfter && Number.isFinite(Number(retryAfter))
        ? ` Retry after ${Math.max(1, Number(retryAfter))} seconds.`
        : ''
    throw new Error(`Spotify API rate limit reached.${retryAfterText}`)
  }

  if (!response.ok) {
    const details = await parseSpotifyError(response)
    throw new Error(`Failed to load Spotify data. ${details}`)
  }

  return response.json() as Promise<T>
}

const forbiddenOptionalPathsByCacheKey = new Map<string, Set<string>>()
const FORBIDDEN_OPTIONAL_PATHS_STORAGE_KEY = 'dayboard_spotify_forbidden_optional_paths_v1'

type ForbiddenOptionalPathStore = Record<string, string[]>

function readForbiddenOptionalPathStore(): ForbiddenOptionalPathStore {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.localStorage.getItem(FORBIDDEN_OPTIONAL_PATHS_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((path) => typeof path === 'string'),
      ),
    )
  } catch {
    return {}
  }
}

function writeForbiddenOptionalPathStore(store: ForbiddenOptionalPathStore) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(FORBIDDEN_OPTIONAL_PATHS_STORAGE_KEY, JSON.stringify(store))
}

function persistForbiddenOptionalPath(cacheKey: string, path: string) {
  const store = readForbiddenOptionalPathStore()
  const existingPaths = new Set(store[cacheKey] ?? [])
  if (existingPaths.has(path)) {
    return
  }
  existingPaths.add(path)
  store[cacheKey] = Array.from(existingPaths)
  writeForbiddenOptionalPathStore(store)
}

function getForbiddenPathSet(cacheKey: string): Set<string> {
  const existing = forbiddenOptionalPathsByCacheKey.get(cacheKey)
  if (existing) {
    return existing
  }

  const store = readForbiddenOptionalPathStore()
  const created = new Set<string>(store[cacheKey] ?? [])
  forbiddenOptionalPathsByCacheKey.set(cacheKey, created)
  return created
}

function filterNonNullItems<T>(items: Array<T | null | undefined> | undefined): T[] {
  return (items ?? []).filter((item): item is T => item !== null && item !== undefined)
}

async function fetchSpotifyOptionalJson<T>(
  accessToken: string,
  path: string,
  options?: {
    skipKnownForbiddenPath?: boolean
    cacheKey?: string
  },
): Promise<T | null> {
  const cacheKey = options?.cacheKey
  const forbiddenPathSet = cacheKey ? getForbiddenPathSet(cacheKey) : null
  if (options?.skipKnownForbiddenPath && forbiddenPathSet?.has(path)) {
    return null
  }

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 403) {
    if (options?.skipKnownForbiddenPath && forbiddenPathSet && cacheKey) {
      forbiddenPathSet.add(path)
      persistForbiddenOptionalPath(cacheKey, path)
    }
    return null
  }

  if (response.status === 204 || response.status === 401) {
    return null
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const retryAfterText =
      retryAfter && Number.isFinite(Number(retryAfter))
        ? ` Retry after ${Math.max(1, Number(retryAfter))} seconds.`
        : ''
    throw new Error(`Spotify API rate limit reached.${retryAfterText}`)
  }

  if (!response.ok) {
    const details = await parseSpotifyError(response)
    throw new Error(`Failed to load Spotify playback state. ${details}`)
  }

  return response.json() as Promise<T>
}

export async function fetchSpotifyAccountSnapshot(auth: SpotifyAuthSession): Promise<SpotifyAccountSnapshot> {
  const validAuth = await getValidSpotifyAuth(auth)
  const [profile, playback, recentlyPlayed, library] = await Promise.all([
    fetchSpotifyJson<SpotifyProfile>(validAuth.accessToken, '/me'),
    fetchSpotifyOptionalJson<SpotifyPlaybackState>(validAuth.accessToken, '/me/player'),
    fetchSpotifyOptionalJson<{ items?: SpotifyRecentPlayedItem[] }>(
      validAuth.accessToken,
      '/me/player/recently-played?limit=10',
    ),
    Promise.all([
      fetchSpotifyOptionalJson<{ items?: SpotifyTopArtistItem[] }>(
        validAuth.accessToken,
        '/me/top/artists?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
      fetchSpotifyOptionalJson<{ items?: SpotifyTopTrackItem[] }>(
        validAuth.accessToken,
        '/me/top/tracks?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
      fetchSpotifyOptionalJson<{ items?: SpotifySavedAlbumItem[] }>(
        validAuth.accessToken,
        '/me/albums?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
      fetchSpotifyOptionalJson<{ items?: SpotifySavedShowItem[] }>(
        validAuth.accessToken,
        '/me/shows?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
      fetchSpotifyOptionalJson<{ items?: SpotifySearchPlaylistItem[] }>(
        validAuth.accessToken,
        '/me/playlists?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
    ]),
  ])

  const [topArtists, topTracks, savedAlbums, savedShows, playlists] = library

  return {
    profile,
    playback,
    recentlyPlayed: filterNonNullItems(recentlyPlayed?.items),
    library: {
      topArtists: filterNonNullItems(topArtists?.items),
      topTracks: filterNonNullItems(topTracks?.items),
      savedAlbums: filterNonNullItems(savedAlbums?.items),
      savedShows: filterNonNullItems(savedShows?.items),
      playlists: filterNonNullItems(playlists?.items),
    },
  }
}

export async function searchSpotifyCatalog(
  auth: SpotifyAuthSession,
  query: string,
): Promise<SpotifySearchResults> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return { tracks: [], albums: [], playlists: [], shows: [], episodes: [] }
  }

  const validAuth = await getValidSpotifyAuth(auth)
  const params = new URLSearchParams({
    q: trimmedQuery,
    type: 'track,album,playlist,show,episode',
    limit: '4',
  })
  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${validAuth.accessToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const retryAfterText =
        retryAfter && Number.isFinite(Number(retryAfter))
          ? ` Retry after ${Math.max(1, Number(retryAfter))} seconds.`
          : ''
      throw new Error(`Spotify API rate limit reached.${retryAfterText}`)
    }
    const details = await parseSpotifyError(response)
    throw new Error(`Failed to search Spotify. ${details}`)
  }

  const data = await response.json() as {
    tracks?: { items?: Array<SpotifySearchTrackItem | null> }
    albums?: { items?: Array<SpotifySearchAlbumItem | null> }
    playlists?: { items?: Array<SpotifySearchPlaylistItem | null> }
    shows?: { items?: Array<SpotifySearchShowItem | null> }
    episodes?: { items?: Array<SpotifySearchEpisodeItem | null> }
  }

  return {
    tracks: filterNonNullItems(data.tracks?.items),
    albums: filterNonNullItems(data.albums?.items),
    playlists: filterNonNullItems(data.playlists?.items),
    shows: filterNonNullItems(data.shows?.items),
    episodes: filterNonNullItems(data.episodes?.items),
  }
}

export interface SpotifyPlayRequest {
  uris?: string[]
  context_uri?: string
  position_ms?: number
}

const SPOTIFY_CONTEXT_TYPES = new Set(['album', 'playlist', 'artist', 'show'])
const SPOTIFY_URI_TYPES = new Set(['track', 'episode'])

/**
 * Converts an open.spotify.com URL (or a spotify: URI) into a Web API play
 * request body. Tracks and episodes are played via `uris`; albums, playlists,
 * artists and shows are played via `context_uri`.
 */
export function spotifyUrlToPlayRequest(value: string): SpotifyPlayRequest | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  let type: string | undefined
  let id: string | undefined

  const uriMatch = trimmed.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/)
  if (uriMatch) {
    type = uriMatch[1]
    id = uriMatch[2]
  } else {
    try {
      const url = new URL(trimmed)
      if (!/(^|\.)spotify\.com$/.test(url.hostname)) {
        return null
      }
      const segments = url.pathname.split('/').filter(Boolean)
      const embedIndex = segments.indexOf('embed')
      const relevant = embedIndex === -1 ? segments : segments.slice(embedIndex + 1)
      type = relevant[0]
      id = relevant[1]
    } catch {
      return null
    }
  }

  if (!type || !id) {
    return null
  }

  if (SPOTIFY_URI_TYPES.has(type)) {
    return { uris: [`spotify:${type}:${id}`] }
  }

  if (SPOTIFY_CONTEXT_TYPES.has(type)) {
    return { context_uri: `spotify:${type}:${id}` }
  }

  return null
}

async function sendSpotifyPlaybackWrite(
  auth: SpotifyAuthSession,
  path: string,
  options?: {
    method?: 'PUT' | 'POST'
    query?: Record<string, string>
    body?: unknown
  },
) {
  const validAuth = await getValidSpotifyAuth(auth)
  const query = options?.query ? `?${new URLSearchParams(options.query).toString()}` : ''
  const hasBody = options?.body !== undefined
  const response = await fetch(`https://api.spotify.com/v1${path}${query}`, {
    method: options?.method ?? 'PUT',
    headers: {
      Authorization: `Bearer ${validAuth.accessToken}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(options?.body) : undefined,
  })

  if (response.status === 204 || response.status === 202 || response.ok) {
    return
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const retryAfterText =
      retryAfter && Number.isFinite(Number(retryAfter))
        ? ` Retry after ${Math.max(1, Number(retryAfter))} seconds.`
        : ''
    throw new Error(`Spotify API rate limit reached.${retryAfterText}`)
  }

  const details = await parseSpotifyError(response)
  throw new Error(`Failed to control Spotify playback. ${details}`)
}

/** Moves playback to the given device (typically the in-browser Web Playback SDK device). */
export async function transferSpotifyPlayback(
  auth: SpotifyAuthSession,
  deviceId: string,
  play = false,
) {
  await sendSpotifyPlaybackWrite(auth, '/me/player', {
    method: 'PUT',
    body: { device_ids: [deviceId], play },
  })
}

/** Starts playback of a track/context on the given device. */
export async function startSpotifyPlayback(
  auth: SpotifyAuthSession,
  deviceId: string,
  request: SpotifyPlayRequest,
) {
  await sendSpotifyPlaybackWrite(auth, '/me/player/play', {
    method: 'PUT',
    query: { device_id: deviceId },
    body: request,
  })
}

/** Sets the playback volume (0-100) for the given device. */
export async function setSpotifyPlaybackVolume(
  auth: SpotifyAuthSession,
  volumePercent: number,
  deviceId?: string,
) {
  const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)))
  await sendSpotifyPlaybackWrite(auth, '/me/player/volume', {
    method: 'PUT',
    query: {
      volume_percent: String(clamped),
      ...(deviceId ? { device_id: deviceId } : {}),
    },
  })
}
