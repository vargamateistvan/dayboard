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

export interface SpotifyAccountSnapshot {
  profile: SpotifyProfile
  playback: SpotifyPlaybackState | null
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

async function fetchSpotifyOptionalJson<T>(accessToken: string, path: string): Promise<T | null> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to load Spotify playback state.')
  }

  return response.json() as Promise<T>
}

export async function fetchSpotifyAccountSnapshot(auth: SpotifyAuthSession): Promise<SpotifyAccountSnapshot> {
  const validAuth = await getValidSpotifyAuth(auth)
  const [profile, playback] = await Promise.all([
    fetchSpotifyJson<SpotifyProfile>(validAuth.accessToken, '/me'),
    fetchSpotifyOptionalJson<SpotifyPlaybackState>(validAuth.accessToken, '/me/player'),
  ])

  return { profile, playback }
}
