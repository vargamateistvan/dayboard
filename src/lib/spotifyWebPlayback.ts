import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getValidSpotifyAuth,
  type SpotifyAuthSession,
} from './spotifyAuth'
import {
  setSpotifyPlaybackVolume,
  startSpotifyPlayback,
  transferSpotifyPlayback,
  type SpotifyPlayRequest,
} from './spotifyApi'

const SPOTIFY_SDK_URL = 'https://sdk.scdn.co/spotify-player.js'
const DEFAULT_DEVICE_NAME = 'Dayboard'
const DEFAULT_VOLUME = 0.5
const POSITION_TICK_MS = 500

interface SpotifyWebPlaybackImage {
  url: string
}

interface SpotifyWebPlaybackTrack {
  uri: string
  id: string | null
  name: string
  duration_ms: number
  album: {
    uri: string
    name: string
    images: SpotifyWebPlaybackImage[]
  }
  artists: Array<{ uri: string; name: string }>
}

interface SpotifyWebPlaybackSdkState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifyWebPlaybackTrack | null
  }
}

interface SpotifyWebPlaybackError {
  message: string
}

interface SpotifyPlayerInit {
  name: string
  getOAuthToken: (callback: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (payload: never) => void) => boolean
  removeListener: (event: string, callback?: (payload: never) => void) => boolean
  getCurrentState: () => Promise<SpotifyWebPlaybackSdkState | null>
  getVolume: () => Promise<number>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  activateElement?: () => Promise<void>
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: {
      Player: new (init: SpotifyPlayerInit) => SpotifyPlayerInstance
    }
  }
}

let sdkLoaderPromise: Promise<void> | null = null

function loadSpotifyPlaybackSdk(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Spotify Web Playback SDK requires a browser environment.'))
  }

  if (window.Spotify) {
    return Promise.resolve()
  }

  if (sdkLoaderPromise) {
    return sdkLoaderPromise
  }

  sdkLoaderPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.()
      resolve()
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SPOTIFY_SDK_URL}"]`)
    if (existingScript) {
      if (window.Spotify) {
        resolve()
      }
      return
    }

    const script = document.createElement('script')
    script.src = SPOTIFY_SDK_URL
    script.async = true
    script.onerror = () => {
      sdkLoaderPromise = null
      reject(new Error('Failed to load the Spotify Web Playback SDK.'))
    }
    document.body.appendChild(script)
  })

  return sdkLoaderPromise
}

export type SpotifyWebPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'error'

export interface SpotifyWebPlaybackNowPlaying {
  uri: string
  name: string
  artists: string
  albumName: string
  artworkUrl?: string
}

export interface SpotifyWebPlaybackState {
  status: SpotifyWebPlaybackStatus
  deviceId: string | null
  isActive: boolean
  isPaused: boolean
  nowPlaying: SpotifyWebPlaybackNowPlaying | null
  positionMs: number
  durationMs: number
  volume: number
  error: string | null
}

export interface SpotifyWebPlaybackControls {
  activate: (request?: SpotifyPlayRequest) => Promise<void>
  togglePlay: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
}

function toNowPlaying(track: SpotifyWebPlaybackTrack | null): SpotifyWebPlaybackNowPlaying | null {
  if (!track) {
    return null
  }

  return {
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(' · '),
    albumName: track.album.name,
    artworkUrl: track.album.images[0]?.url,
  }
}

const INITIAL_STATE: SpotifyWebPlaybackState = {
  status: 'idle',
  deviceId: null,
  isActive: false,
  isPaused: true,
  nowPlaying: null,
  positionMs: 0,
  durationMs: 0,
  volume: DEFAULT_VOLUME,
  error: null,
}

/**
 * Manages the Spotify Web Playback SDK lifecycle so tracks can be streamed
 * directly in the browser. Requires a Spotify Premium account and the
 * `streaming` scope. Returns live playback state plus control callbacks.
 */
export function useSpotifyWebPlayback(
  auth: SpotifyAuthSession | null,
  enabled: boolean,
  deviceName: string = DEFAULT_DEVICE_NAME,
): [SpotifyWebPlaybackState, SpotifyWebPlaybackControls] {
  const [state, setState] = useState<SpotifyWebPlaybackState>(INITIAL_STATE)
  const playerRef = useRef<SpotifyPlayerInstance | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const authRef = useRef<SpotifyAuthSession | null>(auth)
  const positionRef = useRef({ positionMs: 0, durationMs: 0, isPaused: true, updatedAt: Date.now() })

  authRef.current = auth

  useEffect(() => {
    if (!enabled || !auth) {
      return
    }

    let cancelled = false
    let player: SpotifyPlayerInstance | null = null

    setState((previous) => ({ ...INITIAL_STATE, volume: previous.volume, status: 'loading' }))

    const updatePosition = (positionMs: number, durationMs: number, isPaused: boolean) => {
      positionRef.current = { positionMs, durationMs, isPaused, updatedAt: Date.now() }
    }

    const initialize = async () => {
      try {
        await loadSpotifyPlaybackSdk()
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to load the Spotify player.',
          }))
        }
        return
      }

      if (cancelled || !window.Spotify) {
        return
      }

      player = new window.Spotify.Player({
        name: deviceName,
        volume: DEFAULT_VOLUME,
        getOAuthToken: (callback) => {
          const currentAuth = authRef.current
          if (!currentAuth) {
            return
          }
          void getValidSpotifyAuth(currentAuth)
            .then((valid) => callback(valid.accessToken))
            .catch(() => {
              /* token refresh failure surfaces via authentication_error */
            })
        },
      })
      playerRef.current = player

      player.addListener('ready', (payload: never) => {
        const { device_id: deviceId } = payload as unknown as { device_id: string }
        deviceIdRef.current = deviceId
        if (!cancelled) {
          setState((previous) => ({ ...previous, status: 'ready', deviceId, error: null }))
        }
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
        if (!cancelled) {
          setState((previous) => ({ ...previous, deviceId: null, isActive: false }))
        }
      })

      player.addListener('player_state_changed', (payload: never) => {
        const sdkState = payload as unknown as SpotifyWebPlaybackSdkState | null
        if (!sdkState) {
          updatePosition(0, 0, true)
          if (!cancelled) {
            setState((previous) => ({
              ...previous,
              isActive: false,
              isPaused: true,
              nowPlaying: null,
              positionMs: 0,
              durationMs: 0,
            }))
          }
          return
        }

        updatePosition(sdkState.position, sdkState.duration, sdkState.paused)
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            status: 'ready',
            isActive: true,
            isPaused: sdkState.paused,
            nowPlaying: toNowPlaying(sdkState.track_window.current_track),
            positionMs: sdkState.position,
            durationMs: sdkState.duration,
          }))
        }
      })

      const handleFatalError = (label: string) => (payload: never) => {
        const { message } = (payload as unknown as SpotifyWebPlaybackError) ?? { message: label }
        if (!cancelled) {
          setState((previous) => ({ ...previous, status: 'error', error: message || label }))
        }
      }

      const handleAccountError = (payload: never) => {
        const { message } = (payload as unknown as SpotifyWebPlaybackError) ?? { message: '' }
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            status: 'unsupported',
            error: message || 'Spotify Premium is required to play music in the browser.',
          }))
        }
      }

      player.addListener('initialization_error', handleFatalError('Player initialization failed.'))
      player.addListener('authentication_error', handleFatalError('Spotify authentication failed.'))
      player.addListener('playback_error', handleFatalError('Playback failed.'))
      player.addListener('account_error', handleAccountError)

      try {
        const connected = await player.connect()
        if (!connected && !cancelled) {
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: 'Could not connect to the Spotify player.',
          }))
        }
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not connect to the Spotify player.',
          }))
        }
      }
    }

    void initialize()

    const tickId = window.setInterval(() => {
      const { positionMs, durationMs, isPaused, updatedAt } = positionRef.current
      if (isPaused || durationMs <= 0) {
        return
      }
      const projected = Math.min(durationMs, positionMs + (Date.now() - updatedAt))
      setState((previous) => (previous.isActive ? { ...previous, positionMs: projected } : previous))
    }, POSITION_TICK_MS)

    return () => {
      cancelled = true
      window.clearInterval(tickId)
      const activePlayer = player ?? playerRef.current
      if (activePlayer) {
        activePlayer.disconnect()
      }
      playerRef.current = null
      deviceIdRef.current = null
      setState((previous) => ({ ...INITIAL_STATE, volume: previous.volume }))
    }
  }, [auth, enabled, deviceName])

  const activate = useCallback<SpotifyWebPlaybackControls['activate']>(
    async (request) => {
      const currentAuth = authRef.current
      const deviceId = deviceIdRef.current
      if (!currentAuth || !deviceId) {
        throw new Error('The browser player is not ready yet.')
      }

      await playerRef.current?.activateElement?.().catch(() => {
        /* activateElement is best-effort and only needed on some browsers */
      })

      if (request) {
        await startSpotifyPlayback(currentAuth, deviceId, request)
      } else {
        await transferSpotifyPlayback(currentAuth, deviceId, true)
      }
    },
    [],
  )

  const togglePlay = useCallback(async () => {
    await playerRef.current?.togglePlay()
  }, [])

  const next = useCallback(async () => {
    await playerRef.current?.nextTrack()
  }, [])

  const previous = useCallback(async () => {
    await playerRef.current?.previousTrack()
  }, [])

  const seek = useCallback(async (positionMs: number) => {
    const clamped = Math.max(0, Math.round(positionMs))
    await playerRef.current?.seek(clamped)
    positionRef.current = { ...positionRef.current, positionMs: clamped, updatedAt: Date.now() }
    setState((previous) => ({ ...previous, positionMs: clamped }))
  }, [])

  const setVolume = useCallback(async (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    setState((previous) => ({ ...previous, volume: clamped }))
    await playerRef.current?.setVolume(clamped)
    const currentAuth = authRef.current
    const deviceId = deviceIdRef.current
    if (currentAuth && deviceId) {
      await setSpotifyPlaybackVolume(currentAuth, clamped * 100, deviceId).catch(() => {
        /* SDK volume already applied locally; Web API sync is best-effort */
      })
    }
  }, [])

  return [state, { activate, togglePlay, next, previous, seek, setVolume }]
}
