import { useEffect, useRef, useState } from 'react'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { loadSpotifyIframeApi, type SpotifyIframeController } from '../lib/spotifyIframeApi'
import styles from './SpotifyWidget.module.css'

interface SpotifyIframePlayerProps {
  readonly sourceUrl: string
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

function getSpotifyEntityType(sourceUrl: string): 'track' | 'episode' | 'playlist' | 'album' | 'artist' | 'show' | null {
  const match = sourceUrl.match(/open\.spotify\.com\/(track|episode|playlist|album|artist|show)\//)
  return (match?.[1] as ReturnType<typeof getSpotifyEntityType>) ?? null
}

export function SpotifyIframePlayer({
  sourceUrl,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyIframeController | null>(null)
  const loadedSourceUrlRef = useRef<string | null>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const entityType = getSpotifyEntityType(sourceUrl)
  const isCompactEntity = entityType === 'track' || entityType === 'episode'
  const embedHeight =
    embedSize === 'fullscreen'
      ? '100%'
      : isCompactEntity
        ? 152
        : embedSize === 'large'
          ? 460
          : 232

  useEffect(() => {
    let cancelled = false
    const controllerHost = hostRef.current

    if (!controllerHost) {
      return () => {}
    }

    setApiError(null)

    if (!controllerRef.current) {
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
  }, [embedHeight, sourceUrl])

  useEffect(() => {
    if (!isApiReady || !controllerRef.current || loadedSourceUrlRef.current === sourceUrl) {
      return
    }

    controllerRef.current.loadEntity(sourceUrl)
    loadedSourceUrlRef.current = sourceUrl
  }, [isApiReady, sourceUrl])

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
      loadedSourceUrlRef.current = null
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
        style={embedSize === 'fullscreen' ? undefined : { height: `${embedHeight}px` }}
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
