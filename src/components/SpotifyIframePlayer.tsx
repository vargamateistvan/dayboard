import { useEffect, useRef, useState } from 'react'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { loadSpotifyIframeApi, type SpotifyIframeController } from '../lib/spotifyIframeApi'
import styles from './SpotifyWidget.module.css'

interface SpotifyIframePlayerProps {
  readonly sourceUrl: string
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

export function SpotifyIframePlayer({
  sourceUrl,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyIframeController | null>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const embedHeight = embedSize === 'fullscreen' ? '100%' : embedSize === 'large' ? 460 : 232

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
              controller.addListener('ready', () => {
                if (!cancelled) {
                  setIsApiReady(true)
                }
              })
              controller.addListener('playback_update', (event) => {
                void event
              })
              controller.addListener('playback_started', (event) => {
                void event
              })
            },
          )
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setApiError(error instanceof Error ? error.message : 'Failed to load Spotify player.')
          }
        })
    } else if (isApiReady) {
      controllerRef.current.loadEntity(sourceUrl)
    }

    return () => {
      cancelled = true
    }
  }, [embedHeight, isApiReady, sourceUrl])

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
    }
  }, [])

  return (
    <div className={styles.spotifyPlayer}>
      <div className={[styles.embedArea, embedSize === 'fullscreen' ? styles.embedAreaFullscreen : '', embedSize === 'large' ? styles.embedAreaLarge : styles.embedAreaNormal].join(' ')}>
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
