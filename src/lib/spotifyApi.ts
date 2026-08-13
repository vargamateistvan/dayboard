import { getValidSpotifyAuth, type SpotifyAuthSession } from './spotifyAuth'

export interface SpotifyProfile {
  id: string
  display_name: string | null
  images: Array<{ url: string; width?: number; height?: number }>
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

export interface SpotifyLibrarySnapshot {
  topArtists: SpotifyTopArtistItem[]
  topTracks: SpotifyTopTrackItem[]
  savedAlbums: SpotifySavedAlbumItem[]
  playlists: SpotifySearchPlaylistItem[]
}

export interface SpotifyArtistSnapshot {
  artist: SpotifyTopArtistItem
  topTracks: SpotifyTopTrackItem[]
}

export interface SpotifySearchResults {
  tracks: SpotifySearchTrackItem[]
  albums: SpotifySearchAlbumItem[]
  playlists: SpotifySearchPlaylistItem[]
}

export interface SpotifyAccountSnapshot {
  profile: SpotifyProfile
  playback: SpotifyPlaybackState | null
  recentlyPlayed: SpotifyRecentPlayedItem[] | null
  library: SpotifyLibrarySnapshot | null
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

  if (!response.ok) {
    throw new Error('Failed to load Spotify data.')
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

  if (!response.ok) {
    throw new Error('Failed to load Spotify playback state.')
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
      '/me/player/recently-played?limit=3',
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
      fetchSpotifyOptionalJson<{ items?: SpotifySearchPlaylistItem[] }>(
        validAuth.accessToken,
        '/me/playlists?limit=5',
        { skipKnownForbiddenPath: true, cacheKey: validAuth.refreshToken },
      ),
    ]),
  ])

  const [topArtists, topTracks, savedAlbums, playlists] = library

  return {
    profile,
    playback,
    recentlyPlayed: filterNonNullItems(recentlyPlayed?.items),
    library: {
      topArtists: filterNonNullItems(topArtists?.items),
      topTracks: filterNonNullItems(topTracks?.items),
      savedAlbums: filterNonNullItems(savedAlbums?.items),
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
    return { tracks: [], albums: [], playlists: [] }
  }

  const validAuth = await getValidSpotifyAuth(auth)
  const params = new URLSearchParams({
    q: trimmedQuery,
    type: 'track,album,playlist',
    limit: '4',
  })
  const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${validAuth.accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to search Spotify.')
  }

  const data = await response.json() as {
    tracks?: { items?: Array<SpotifySearchTrackItem | null> }
    albums?: { items?: Array<SpotifySearchAlbumItem | null> }
    playlists?: { items?: Array<SpotifySearchPlaylistItem | null> }
  }

  return {
    tracks: filterNonNullItems(data.tracks?.items),
    albums: filterNonNullItems(data.albums?.items),
    playlists: filterNonNullItems(data.playlists?.items),
  }
}

export async function fetchSpotifyArtistSnapshot(
  auth: SpotifyAuthSession,
  artistId: string,
): Promise<SpotifyArtistSnapshot> {
  const trimmedArtistId = artistId.trim()
  if (!trimmedArtistId) {
    throw new Error('Spotify artist id is required.')
  }

  const validAuth = await getValidSpotifyAuth(auth)
  const [artistResponse, topTracksResponse] = await Promise.all([
    fetchSpotifyJson<SpotifyTopArtistItem>(validAuth.accessToken, `/artists/${trimmedArtistId}`),
    fetchSpotifyJson<{ tracks?: SpotifyTopTrackItem[] }>(
      validAuth.accessToken,
      `/artists/${trimmedArtistId}/top-tracks?market=from_token`,
    ),
  ])

  return {
    artist: artistResponse,
    topTracks: topTracksResponse.tracks ?? [],
  }
}
