import { useEffect, useRef, useState } from 'react'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { loadSpotifyIframeApi, type SpotifyIframeController } from '../lib/spotifyIframeApi'
import styles from './SpotifyWidget.module.css'

interface SpotifyIframePlayerProps {
  readonly sourceUrl: string
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

type SpotifyEntityType = 'track' | 'episode' | 'playlist' | 'album' | 'artist' | 'show'
const SPOTIFY_ENTITY_TYPES: Set<SpotifyEntityType> = new Set([
  'track',
  'episode',
  'playlist',
  'album',
  'artist',
  'show',
])

function getSpotifyEntityType(sourceUrl: string): SpotifyEntityType | null {
  try {
    const parsed = new URL(sourceUrl)
    if (parsed.hostname !== 'open.spotify.com') {
      return null
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) {
      return null
    }

    const normalizedSegments =
      segments[0]?.startsWith('intl-') ? segments.slice(1) : segments
    const firstSegment = normalizedSegments[0]
    const secondSegment = normalizedSegments[1]
    const type = firstSegment === 'embed' ? secondSegment : firstSegment

    if (type && SPOTIFY_ENTITY_TYPES.has(type as SpotifyEntityType)) {
      return type as SpotifyEntityType
    }
    return null
  } catch {
    return null
  }
}

function getSpotifyEntityKey(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl)
    if (parsed.hostname !== 'open.spotify.com') {
      return null
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) {
      return null
    }

    const normalizedSegments = segments[0]?.startsWith('intl-') ? segments.slice(1) : segments
    const firstSegment = normalizedSegments[0]
    const secondSegment = normalizedSegments[1]
    const thirdSegment = normalizedSegments[2]
    const type = firstSegment === 'embed' ? secondSegment : firstSegment
    const id = firstSegment === 'embed' ? thirdSegment : secondSegment

    if (!type || !id || !SPOTIFY_ENTITY_TYPES.has(type as SpotifyEntityType)) {
      return null
    }

    return `${type}:${id}`
  } catch {
    return null
  }
}

export function SpotifyIframePlayer({
  sourceUrl,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyIframeController | null>(null)
  const loadedSourceUrlRef = useRef<string | null>(null)
  const loadedEntityKeyRef = useRef<string | null>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const entityType = getSpotifyEntityType(sourceUrl)
  const sourceEntityKey = getSpotifyEntityKey(sourceUrl)
  const isCompactEntity = entityType === 'track' || entityType === 'episode'
  const embedHeight =
    embedSize === 'fullscreen'
      ? '100%'
      : isCompactEntity
        ? 80
        : embedSize === 'large'
          ? 460
          : 232

  useEffect(() => {
    let cancelled = false
    const controllerHost = hostRef.current

    if (!controllerHost) {
      return () => {}
    }

    if (!controllerRef.current) {
      setApiError(null)
      controllerHost.innerHTML = ''
      setIsApiReady(false)

      void loadSpotifyIframeApi()
        .then((api) => {
          if (cancelled || !hostRef.current || hostRef.current !== controllerHost || !controllerHost.isConnected) {
            return
          }
          api.createController(
            controllerHost,
            {
              url: sourceUrl,
              width: '100%',
              height: embedHeight,
            },
            (controller) => {
              if (cancelled || !controllerHost.isConnected) {
                controller.destroy()
                return
              }

              controllerRef.current = controller
              loadedSourceUrlRef.current = sourceUrl
              loadedEntityKeyRef.current = sourceEntityKey
              controller.addListener('ready', () => {
                if (!cancelled) {
                  setIsApiReady(true)
                }
              })
            },
          )
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setApiError(error instanceof Error ? error.message : 'Failed to load Spotify player.')
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [embedHeight, sourceEntityKey, sourceUrl])

  useEffect(() => {
    if (!isApiReady || !controllerRef.current) {
      return
    }

    if (sourceEntityKey && loadedEntityKeyRef.current === sourceEntityKey) {
      return
    }

    if (!sourceEntityKey && loadedSourceUrlRef.current === sourceUrl) {
      return
    }

    controllerRef.current.loadEntity(sourceUrl)
    loadedSourceUrlRef.current = sourceUrl
    loadedEntityKeyRef.current = sourceEntityKey
  }, [isApiReady, sourceEntityKey, sourceUrl])

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
      loadedSourceUrlRef.current = null
      loadedEntityKeyRef.current = null
    }
  }, [])

  return (
    <div className={styles.spotifyPlayer}>
      <div
        className={[
          styles.embedArea,
          embedSize === 'fullscreen' ? styles.embedAreaFullscreen : '',
          embedSize === 'large' ? styles.embedAreaLarge : styles.embedAreaNormal,
        ].join(' ')}
        style={
          embedSize === 'fullscreen'
            ? undefined
            : { height: `${embedHeight}px`, minHeight: `${embedHeight}px` }
        }
      >
        {apiError ? <div className={styles.error}>{apiError}</div> : null}
        {!isApiReady ? (
          <div className={styles.spotifyFallbackLayer}>
            <MusicEmbedWidget
              title="Spotify Player"
              provider="spotify"
              shareUrl={sourceUrl}
              showHeader={false}
              showStatus={false}
              showActions={false}
              embedSize={embedSize}
              colorScheme={colorScheme}
            />
          </div>
        ) : null}
        <div ref={hostRef} className={styles.spotifyIframeHost} />
      </div>
    </div>
  )
}
