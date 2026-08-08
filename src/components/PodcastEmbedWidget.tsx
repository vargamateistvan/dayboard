import { normalizeApplePodcastEmbedUrl, normalizeSpotifyPodcastEmbedUrl } from '../lib/musicEmbeds'
import styles from './MusicEmbedWidget.module.css'

interface PodcastEmbedWidgetProps {
  readonly title: string
  readonly provider: 'spotify' | 'apple-podcast'
  readonly shareUrl: string
  readonly showHeader?: boolean
  readonly showStatus?: boolean
  readonly showActions?: boolean
  readonly embedSize?: 'normal' | 'large'
  readonly colorScheme?: 'light' | 'dark'
}

const DEFAULT_SHARE_URLS: Record<PodcastEmbedWidgetProps['provider'], string> = {
  spotify: 'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk',
  'apple-podcast': 'https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272',
}

function getEmbedUrl(provider: PodcastEmbedWidgetProps['provider'], shareUrl: string): string | null {
  if (provider === 'spotify') {
    return normalizeSpotifyPodcastEmbedUrl(shareUrl)
  }

  return normalizeApplePodcastEmbedUrl(shareUrl)
}

function withProviderTheme(
  provider: PodcastEmbedWidgetProps['provider'],
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

export function PodcastEmbedWidget({
  title,
  provider,
  shareUrl,
  showHeader = true,
  showStatus = true,
  showActions = true,
  embedSize = 'normal',
  colorScheme = 'dark',
}: PodcastEmbedWidgetProps) {
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
      : 'https://podcasts.apple.com'
  const openPlayerUrl =
    resolvedShareUrl ||
    (provider === 'spotify' ? 'https://open.spotify.com/' : 'https://podcasts.apple.com/')

  return (
    <div className={styles.widget}>
      {showHeader && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
        </div>
      )}

      {showStatus && !hasCustomUrl && (
        <div className={styles.empty}>
          Showing a demo podcast. Add your own {provider === 'spotify' ? 'Spotify' : 'Apple Podcast'} link in settings.
        </div>
      )}

      {showStatus && hasCustomUrl && !embedUrl && (
        <div className={styles.error}>
          This link is not a valid {provider === 'spotify' ? 'Spotify' : 'Apple Podcast'} URL.
        </div>
      )}

      {themedEmbedUrl && (
        <div
          className={[
            styles.playerFrame,
            embedSize === 'large' ? styles.playerFrameLarge : '',
          ].join(' ')}
        >
          <iframe
            className={styles.player}
            src={themedEmbedUrl}
            title={`${title} player`}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
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
