import { MusicEmbedWidget } from './MusicEmbedWidget'
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

    const normalizedSegments = segments[0]?.startsWith('intl-') ? segments.slice(1) : segments
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

export function SpotifyIframePlayer({
  sourceUrl,
  colorScheme,
  embedSize,
}: SpotifyIframePlayerProps) {
  const entityType = getSpotifyEntityType(sourceUrl)
  const isCompactEntity = entityType === 'track' || entityType === 'episode'
  const embedHeight =
    embedSize === 'fullscreen'
      ? undefined
      : isCompactEntity
        ? 152
        : embedSize === 'large'
          ? 460
          : 232

  return (
    <div className={styles.spotifyPlayer}>
      <div
        className={[
          styles.embedArea,
          embedSize === 'fullscreen' ? styles.embedAreaFullscreen : '',
          embedSize === 'large' ? styles.embedAreaLarge : styles.embedAreaNormal,
        ].join(' ')}
        style={embedHeight ? { height: `${embedHeight}px`, minHeight: `${embedHeight}px` } : undefined}
      >
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
    </div>
  )
}
