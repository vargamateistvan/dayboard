import { ExternalLink, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { MediaBrandIcon } from './MediaBrandIcon'
import styles from './SpotifyWidget.module.css'

interface SpotifyIframePlayerProps {
  readonly sourceUrl: string
  readonly title: string
  readonly subtitle: string
  readonly artworkUrl?: string
  readonly isPlaying: boolean
  readonly progressMs: number | null
  readonly durationMs: number | null
  readonly isLivePlayback: boolean
  readonly controlsDisabled: boolean
  readonly onPrevious: () => void
  readonly onTogglePlay: () => void
  readonly onNext: () => void
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

function formatDuration(milliseconds: number | null): string {
  if (!milliseconds || milliseconds <= 0) {
    return '--:--'
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function SpotifyIframePlayer({
  sourceUrl,
  title,
  subtitle,
  artworkUrl,
  isPlaying,
  progressMs,
  durationMs,
  isLivePlayback,
  controlsDisabled,
  onPrevious,
  onTogglePlay,
  onNext,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const resolvedProgressMs = Math.max(0, progressMs ?? 0)
  const resolvedDurationMs = durationMs && durationMs > 0 ? durationMs : null
  const progressPercent = resolvedDurationMs
    ? Math.min(100, Math.max(0, (resolvedProgressMs / resolvedDurationMs) * 100))
    : 0

  return (
    <section
      className={[
        styles.spotifyPlayer,
        styles.customPlayerCard,
        colorScheme === 'light' ? styles.customPlayerCardLight : '',
        embedSize === 'large' || embedSize === 'fullscreen' ? styles.customPlayerCardLarge : '',
      ].join(' ')}
    >
      <div
        className={styles.customPlayerArtwork}
        aria-hidden="true"
      >
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className={styles.customPlayerArtworkImage} />
        ) : (
          <MediaBrandIcon brand="spotify" size={26} />
        )}
      </div>

      <div className={styles.customPlayerBody}>
        <div className={styles.customPlayerTitleRow}>
          <div className={styles.customPlayerTitleGroup}>
            <div className={styles.customPlayerTitle}>{title}</div>
            <div className={styles.customPlayerSubtitle}>{subtitle}</div>
          </div>
          <span className={styles.customPlayerLiveBadge}>
            {isLivePlayback ? (isPlaying ? 'Live' : 'Paused') : 'Selected'}
          </span>
        </div>

        <div className={styles.customPlayerProgressWrap}>
          <div className={styles.customPlayerTime}>{formatDuration(resolvedProgressMs)}</div>
          <div className={styles.customPlayerProgressTrack} aria-hidden="true">
            <div className={styles.customPlayerProgressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.customPlayerTime}>{formatDuration(resolvedDurationMs)}</div>
        </div>

        <div className={styles.customPlayerControls}>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            disabled={controlsDisabled}
            aria-label="Previous"
            onClick={onPrevious}
          >
            <SkipBack size={14} />
          </button>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            disabled={controlsDisabled}
            aria-label="Play or pause"
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            className={styles.customPlayerIconButton}
            type="button"
            disabled={controlsDisabled}
            aria-label="Next"
            onClick={onNext}
          >
            <SkipForward size={14} />
          </button>
          <div className={styles.customPlayerVolume}>
            <Volume2 size={14} />
          </div>
          <a
            className={styles.customPlayerOpenLink}
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </section>
  )
}
