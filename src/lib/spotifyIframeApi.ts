export interface SpotifyIframePlaybackState {
  readonly playingURI: string
  readonly isPaused: boolean
  readonly isBuffering: boolean
  readonly duration: number
  readonly position: number
}

export interface SpotifyIframeController {
  loadEntity(spotifyUriOrUrl: string, preferVideo?: boolean, startAt?: number): void
  loadUri(spotifyUri: string, preferVideo?: boolean, startAt?: number): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  restart(): void
  seek(seconds: number): void
  destroy(): void
  addListener(
    event: 'ready' | 'playback_started' | 'playback_update',
    listener: (event: { data: SpotifyIframePlaybackState | { playingURI: string } }) => void,
  ): void
}

export interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: {
      uri?: string
      url?: string
      width?: number | string
      height?: number | string
    },
    callback: (controller: SpotifyIframeController) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void
    SpotifyIframeApi?: SpotifyIframeApi
  }
}

let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | null = null

export function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Spotify iframe API is only available in the browser.'))
  }

  const existingApi = window.SpotifyIframeApi as SpotifyIframeApi | undefined
  if (existingApi) {
    return Promise.resolve(existingApi)
  }

  if (spotifyIframeApiPromise) {
    return spotifyIframeApiPromise
  }

  spotifyIframeApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const scriptId = 'dayboard-spotify-iframe-api'
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api
      resolve(api)
    }

    if (existingScript) {
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.onerror = () => {
      spotifyIframeApiPromise = null
      reject(new Error('Failed to load the Spotify iframe API.'))
    }
    document.body.appendChild(script)
  })

  return spotifyIframeApiPromise
}
