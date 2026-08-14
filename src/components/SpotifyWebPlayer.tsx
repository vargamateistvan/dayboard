import { useState, type ChangeEvent } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { spotifyUrlToPlayRequest } from '../lib/spotifyApi'
import { useSpotifyWebPlayback } from '../lib/spotifyWebPlayback'
import type { SpotifyAuthSession } from '../lib/spotifyAuth'
import styles from './SpotifyWidget.module.css'

interface SpotifyWebPlayerProps {
  readonly auth: SpotifyAuthSession
  readonly enabled: boolean
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
  readonly selectionUrl?: string
  readonly selectionLabel?: string
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0:00'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SpotifyWebPlayer({
  auth,
  enabled,
  colorScheme,
  embedSize,
  selectionUrl,
  selectionLabel,
}: SpotifyWebPlayerProps) {
  const [state, controls] = useSpotifyWebPlayback(auth, enabled)
  const [actionError, setActionError] = useState<string | null>(null)
  const [scrubMs, setScrubMs] = useState<number | null>(null)

  if (!enabled) {
    return null
  }

  const cardClassName = [
    styles.spotifyPlayer,
    styles.customPlayerCard,
    colorScheme === 'light' ? styles.customPlayerCardLight : '',
    embedSize === 'large' || embedSize === 'fullscreen' ? styles.customPlayerCardLarge : '',
  ].join(' ')

  if (state.status === 'loading' || state.status === 'idle') {
    return <div className={styles.connectHint}>Starting the in-browser player…</div>
  }

  if (state.status === 'unsupported') {
    return (
      <div className={styles.error}>
        {state.error ?? 'Playing in the browser requires a Spotify Premium account.'}
      </div>
    )
  }

  if (state.status === 'error') {
    return <div className={styles.error}>{state.error ?? 'The in-browser player is unavailable.'}</div>
  }

  const playSelectionRequest = selectionUrl ? spotifyUrlToPlayRequest(selectionUrl) : null

  const runAction = (action: () => Promise<void>) => {
    setActionError(null)
    void action().catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : 'Playback command failed.')
    })
  }

  if (!state.isActive) {
    return (
      <div className={styles.browserPlayerReady}>
        <div className={styles.connectHint}>Ready to stream in this browser.</div>
        <div className={styles.browserPlayerActions}>
          {playSelectionRequest ? (
            <button
              className={styles.button}
              type="button"
              onClick={() => runAction(() => controls.activate(playSelectionRequest))}
            >
              Play{selectionLabel ? ` “${selectionLabel}”` : ''} here
            </button>
          ) : null}
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() => runAction(() => controls.activate())}
          >
            Transfer playback here
          </button>
        </div>
        {actionError ? <div className={styles.error}>{actionError}</div> : null}
      </div>
    )
  }

  const durationMs = state.durationMs
  const positionMs = scrubMs ?? state.positionMs
  const artworkUrl = state.nowPlaying?.artworkUrl
  const volumePercent = Math.round(state.volume * 100)
  const VolumeIcon = state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2

  const handleSeekChange = (event: ChangeEvent<HTMLInputElement>) => {
    setScrubMs(Number(event.target.value))
  }

  const commitSeek = () => {
    if (scrubMs === null) {
      return
    }
    const target = scrubMs
    setScrubMs(null)
    runAction(() => controls.seek(target))
  }

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    runAction(() => controls.setVolume(Number(event.target.value) / 100))
  }

  return (
    <section className={cardClassName}>
      <div className={styles.customPlayerArtwork} aria-hidden="true">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className={styles.customPlayerArtworkImage} />
        ) : (
          <MediaBrandIcon brand="spotify" size={26} />
        )}
      </div>

      <div className={styles.customPlayerBody}>
        <div className={styles.customPlayerTitleRow}>
          <div className={styles.customPlayerTitleGroup}>
            <div className={styles.customPlayerTitle}>{state.nowPlaying?.name ?? 'Nothing playing'}</div>
            <div className={styles.customPlayerSubtitle}>
              {state.nowPlaying?.artists || state.nowPlaying?.albumName || 'Spotify'}
            </div>
          </div>
          <span className={styles.customPlayerLiveBadge}>{state.isPaused ? 'Paused' : 'In browser'}</span>
        </div>

        <div className={styles.customPlayerProgressWrap}>
          <div className={styles.customPlayerTime}>{formatDuration(positionMs)}</div>
          <input
            className={styles.browserPlayerSlider}
            type="range"
            min={0}
            max={durationMs > 0 ? durationMs : 0}
            step={1000}
            value={durationMs > 0 ? Math.min(positionMs, durationMs) : 0}
            disabled={durationMs <= 0}
            aria-label="Seek"
            onChange={handleSeekChange}
            onMouseUp={commitSeek}
            onTouchEnd={commitSeek}
            onKeyUp={commitSeek}
          />
          <div className={styles.customPlayerTime}>{formatDuration(durationMs)}</div>
        </div>

        <div className={styles.customPlayerControls}>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            aria-label="Previous"
            onClick={() => runAction(() => controls.previous())}
          >
            <SkipBack size={14} />
          </button>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            aria-label="Play or pause"
            onClick={() => runAction(() => controls.togglePlay())}
          >
            {state.isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            aria-label="Next"
            onClick={() => runAction(() => controls.next())}
          >
            <SkipForward size={14} />
          </button>
          <div className={styles.browserPlayerVolume}>
            <VolumeIcon size={14} />
            <input
              className={styles.browserPlayerSlider}
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              aria-label="Volume"
              onChange={handleVolumeChange}
            />
          </div>
        </div>

        {actionError ? <div className={styles.error}>{actionError}</div> : null}
      </div>
    </section>
  )
}
