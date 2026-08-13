import { useEffect, useMemo, useRef, useState } from 'react'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { loadSpotifyIframeApi, type SpotifyIframeController, type SpotifyIframePlaybackState } from '../lib/spotifyIframeApi'
import styles from './SpotifyWidget.module.css'

interface SpotifyIframePlayerProps {
  readonly sourceUrl: string
  readonly title: string
  readonly subtitle: string
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) {
    return '0:00'
  }

  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatProgress(state: SpotifyIframePlaybackState | null): string {
  if (!state || state.duration <= 0) {
    return '0:00'
  }

  return `${formatDuration(state.position)} / ${formatDuration(state.duration)}`
}

function getProgressPercent(state: SpotifyIframePlaybackState | null): number {
  if (!state || state.duration <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (state.position / state.duration) * 100))
}

export function SpotifyIframePlayer({
  sourceUrl,
  title,
  subtitle,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyIframeController | null>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [playbackState, setPlaybackState] = useState<SpotifyIframePlaybackState | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const canTogglePlay = isApiReady && controllerRef.current
  const playButtonLabel = useMemo(() => {
    if (!isApiReady) {
      return 'Loading player…'
    }

    if (!playbackState || playbackState.isPaused) {
      return 'Play'
    }

    return 'Pause'
  }, [isApiReady, playbackState])
  const statusLabel = playbackState
    ? playbackState.isBuffering
      ? 'Buffering'
      : playbackState.isPaused
        ? 'Paused'
        : 'Playing'
    : isApiReady
      ? 'Ready'
      : 'Loading'
  const progressPercent = getProgressPercent(playbackState)

  useEffect(() => {
    let cancelled = false
    const controllerHost = hostRef.current

    if (!controllerHost) {
      return () => {}
    }

    controllerHost.innerHTML = ''
    controllerRef.current?.destroy()
    controllerRef.current = null
    setIsApiReady(false)
    setPlaybackState(null)
    setApiError(null)

    void loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled || !hostRef.current) {
          return
        }
        api.createController(
          controllerHost,
          {
            url: sourceUrl,
            width: '100%',
            height: '100%',
          },
          (controller) => {
            if (cancelled) {
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
              if (!cancelled) {
                setPlaybackState(event.data as SpotifyIframePlaybackState)
              }
            })
            controller.addListener('playback_started', (event) => {
              if (!cancelled) {
                setPlaybackState((current) => ({
                  ...(current ?? {
                    duration: 0,
                    position: 0,
                    isPaused: false,
                    isBuffering: false,
                    playingURI: sourceUrl,
                  }),
                  playingURI: (event.data as { playingURI: string }).playingURI,
                  isPaused: false,
                }))
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

    return () => {
      cancelled = true
      controllerRef.current?.destroy()
      controllerRef.current = null
    }
  }, [sourceUrl])

  const handleTogglePlay = () => {
    controllerRef.current?.togglePlay()
  }

  const handleRestart = () => {
    controllerRef.current?.restart()
  }

  return (
    <div className={styles.spotifyPlayer}>
      <div className={styles.playerHeader}>
        <div>
          <div className={styles.playerLabel}>{title}</div>
          <div className={styles.playerSubLabel}>{subtitle}</div>
        </div>
        <div className={styles.playerActions}>
          <button
            className={styles.actionButton}
            type="button"
            onClick={handleTogglePlay}
            disabled={!canTogglePlay}
          >
            {playButtonLabel}
          </button>
          <button
            className={styles.actionButton}
            type="button"
            onClick={handleRestart}
            disabled={!canTogglePlay}
          >
            Restart
          </button>
          <a className={styles.actionButtonLink} href={sourceUrl} target="_blank" rel="noreferrer">
            Open in Spotify
          </a>
        </div>
      </div>

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

      <div className={styles.spotifyMetaRow}>
        <span className={styles.spotifyPill}>{statusLabel}</span>
        <span className={styles.spotifyPill}>{formatProgress(playbackState)}</span>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  )
}
