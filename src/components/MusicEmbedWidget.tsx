import { normalizeAppleMusicEmbedUrl, normalizeSpotifyEmbedUrl } from '../lib/musicEmbeds'
import styles from './MusicEmbedWidget.module.css'

interface MusicEmbedWidgetProps {
  readonly title: string
  readonly provider: 'spotify' | 'apple-music'
  readonly shareUrl: string
  readonly showHeader?: boolean
  readonly showStatus?: boolean
  readonly showActions?: boolean
  readonly embedSize?: 'normal' | 'large' | 'fullscreen'
  readonly colorScheme?: 'light' | 'dark'
}

const DEFAULT_SHARE_URLS: Record<MusicEmbedWidgetProps['provider'], string> = {
  spotify: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  'apple-music': 'https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378110',
}

function getEmbedUrl(provider: MusicEmbedWidgetProps['provider'], shareUrl: string): string | null {
  if (provider === 'spotify') {
    return normalizeSpotifyEmbedUrl(shareUrl)
  }

  return normalizeAppleMusicEmbedUrl(shareUrl)
}

function withProviderTheme(
  provider: MusicEmbedWidgetProps['provider'],
  embedUrl: string,
  colorScheme: 'light' | 'dark',
): string {
  const url = new URL(embedUrl)

  if (provider === 'spotify') {
    url.searchParams.set('theme', colorScheme === 'dark' ? '0' : '1')
    return url.toString()
  }

  url.searchParams.set('theme', colorScheme)
  return url.toString()
}

export function MusicEmbedWidget({
  title,
  provider,
  shareUrl,
  showHeader = true,
  showStatus = true,
  showActions = true,
  embedSize = 'normal',
  colorScheme = 'dark',
}: MusicEmbedWidgetProps) {
  const trimmedUrl = shareUrl.trim()
  const hasCustomUrl = trimmedUrl.length > 0
  const resolvedShareUrl = hasCustomUrl ? trimmedUrl : DEFAULT_SHARE_URLS[provider]
  const embedUrl = getEmbedUrl(provider, resolvedShareUrl)
  const themedEmbedUrl = embedUrl
    ? withProviderTheme(provider, embedUrl, colorScheme)
    : null
  const signInUrl =
    provider === 'spotify'
      ? 'https://accounts.spotify.com/login'
      : 'https://music.apple.com/login'
  const openPlayerUrl =
    resolvedShareUrl ||
    (provider === 'spotify' ? 'https://open.spotify.com/' : 'https://music.apple.com/')

  return (
    <div className={styles.widget}>
      {showHeader && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
        </div>
      )}

      {showStatus && !hasCustomUrl && (
        <div className={styles.empty}>
          Showing a demo player. Add your own {provider === 'spotify' ? 'Spotify' : 'Apple Music'} link in settings.
        </div>
      )}

      {showStatus && hasCustomUrl && !embedUrl && (
        <div className={styles.error}>
          This link is not a valid {provider === 'spotify' ? 'Spotify' : 'Apple Music'} URL.
        </div>
      )}

      {themedEmbedUrl && (
        <div
          className={[
            styles.playerFrame,
            embedSize === 'large' ? styles.playerFrameLarge : '',
            embedSize === 'fullscreen' ? styles.playerFrameFullscreen : '',
          ].join(' ')}
        >
          <iframe
            className={styles.player}
            src={themedEmbedUrl}
            title={`${title} player`}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      )}

      {showActions && (
        <div className={styles.actions}>
          <a
            className={styles.actionBtn}
            href={signInUrl}
            target="_blank"
            rel="noreferrer"
          >
            Sign in
          </a>
          <a
            className={styles.actionBtn}
            href={openPlayerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open full player
          </a>
        </div>
      )}
    </div>
  )
}
