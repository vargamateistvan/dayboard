import { useEffect, useMemo, useState } from 'react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme } from '../lib/settings'
import { fetchSpotifyAccountSnapshot, type SpotifyAccountSnapshot } from '../lib/spotifyApi'
import { getStoredSpotifyAuth, onSpotifyAuthChanged, startSpotifyLogin } from '../lib/spotifyAuth'
import styles from './SpotifyWidget.module.css'

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean
}

export function SpotifyWidget({ isFullscreen = false }: SpotifyWidgetProps) {
  const { settings } = useSettings()
  const { placements } = useWidgetVisibility()
  const [spotifyState, setSpotifyState] = useState<SpotifyAccountSnapshot | null>(null)
  const [spotifyStateLoading, setSpotifyStateLoading] = useState(false)
  const [spotifyStateError, setSpotifyStateError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const isLargeEmbed = placements.spotify.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  useEffect(() => {
    let cancelled = false

    const syncSpotifyAccount = async () => {
      const auth = getStoredSpotifyAuth()
      if (!auth) {
        if (!cancelled) {
          setSpotifyState(null)
          setSpotifyStateError(null)
          setSpotifyStateLoading(false)
        }
        return
      }

      if (!cancelled) {
        setSpotifyStateLoading(true)
        setSpotifyStateError(null)
      }

      try {
        const snapshot = await fetchSpotifyAccountSnapshot(auth)
        if (!cancelled) {
          setSpotifyState(snapshot)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSpotifyState(null)
          setSpotifyStateError(loadError instanceof Error ? loadError.message : 'Failed to load Spotify data.')
        }
      } finally {
        if (!cancelled) {
          setSpotifyStateLoading(false)
        }
      }
    }

    const stopListening = onSpotifyAuthChanged(() => {
      void syncSpotifyAccount()
    })

    void syncSpotifyAccount()
    const intervalId = window.setInterval(() => {
      void syncSpotifyAccount()
    }, 60_000)

    return () => {
      cancelled = true
      stopListening()
      window.clearInterval(intervalId)
    }
  }, [])

  const isConnected = Boolean(spotifyState)
  const playerUrl = useMemo(() => {
    return (
      spotifyState?.playback?.item?.external_urls.spotify ??
      spotifyState?.recentlyPlayed?.[0]?.track.external_urls.spotify ??
      ''
    )
  }, [spotifyState])

  const handleConnectSpotify = () => {
    setConnectError(null)
    void startSpotifyLogin().catch((error: unknown) => {
      setConnectError(error instanceof Error ? error.message : 'Spotify login failed.')
    })
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
      {!isConnected ? (
        <section className={styles.connectCard}>
          <button className={styles.connectButton} type="button" onClick={handleConnectSpotify}>
            <MediaBrandIcon brand="spotify" size={14} className={styles.connectIcon} />
            <span>Connect Spotify</span>
          </button>
          <p className={styles.connectHint}>
            Connect Spotify to show the player here.
          </p>
          {connectError && <div className={styles.error}>{connectError}</div>}
        </section>
      ) : (
        <div
          className={[
            styles.embedArea,
            isFullscreen ? styles.embedAreaFullscreen : '',
            isLargeEmbed ? styles.embedAreaLarge : styles.embedAreaNormal,
          ].join(' ')}
        >
          {spotifyStateLoading && <div className={styles.connectHint}>Refreshing Spotify player…</div>}
          {spotifyStateError && <div className={styles.error}>{spotifyStateError}</div>}
          {!spotifyStateLoading && !spotifyStateError && playerUrl ? (
            <MusicEmbedWidget
              title="Spotify Player"
              provider="spotify"
              shareUrl={playerUrl}
              showHeader={false}
              showStatus={false}
              showActions={false}
              embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
              colorScheme={resolvedColorScheme}
            />
          ) : null}
          {!spotifyStateLoading && !spotifyStateError && !playerUrl ? (
            <div className={styles.connectHint}>Open Spotify and start playing to show the player.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
