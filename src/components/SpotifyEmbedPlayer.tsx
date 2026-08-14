import { normalizeSpotifyEmbedUrl } from '../lib/musicEmbeds'
import styles from './SpotifyWidget.module.css'

interface SpotifyEmbedPlayerProps {
  readonly selection: {
    readonly url: string
    readonly title: string
  } | null
  readonly colorScheme: 'light' | 'dark'
  readonly embedSize: 'normal' | 'large' | 'fullscreen'
}

/**
 * Fallback player for accounts without Spotify Premium. Loads the selected
 * item into Spotify's embedded iframe player: full tracks when the user is
 * logged into Spotify in this browser, 30-second previews otherwise.
 */
export function SpotifyEmbedPlayer({ selection, colorScheme, embedSize }: SpotifyEmbedPlayerProps) {
  if (!selection) {
    return (
      <div className={styles.connectHint}>
        Pick a song, album, playlist, or podcast to play it here.
      </div>
    )
  }

  const embedUrl = normalizeSpotifyEmbedUrl(selection.url)
  if (!embedUrl) {
    return <div className={styles.error}>“{selection.title}” cannot be played here.</div>
  }

  const themedUrl = new URL(embedUrl)
  themedUrl.searchParams.set('theme', colorScheme === 'dark' ? '0' : '1')

  // Track and episode embeds cap their content at 352px — taller iframes just
  // show blank filler. Context embeds (album/playlist/show/artist) render a
  // scrollable tracklist, so they should fill all the space they can get.
  const embedType = themedUrl.pathname.split('/')[2] ?? ''
  const isFixedHeightEmbed = embedType === 'track' || embedType === 'episode'

  const sizeClass = isFixedHeightEmbed
    ? embedSize === 'normal'
      ? styles.embedAreaNormal
      : styles.embedAreaTrack
    : embedSize === 'fullscreen'
      ? styles.embedAreaFullscreen
      : embedSize === 'large'
        ? styles.embedAreaLarge
        : styles.embedAreaNormal

  return (
    <div className={[styles.embedArea, sizeClass].join(' ')}>
      <iframe
        className={styles.embedFrame}
        src={themedUrl.toString()}
        title={`Spotify player: ${selection.title}`}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    </div>
  )
}
