import { FormEvent, useEffect, useState } from 'react'
import { normalizeSpotifyPodcastEmbedUrl } from '../lib/musicEmbeds'
import { resolveColorScheme } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { PodcastEmbedWidget } from './PodcastEmbedWidget'
import styles from './SpotifyWidget.module.css'

export function SpotifyPodcastWidget() {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const [shareUrl, setShareUrl] = useState(settings.spotifyPodcastEmbedUrl)
  const [error, setError] = useState<string | null>(null)
  const isLargeEmbed = placements.spotifyPodcast?.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  useEffect(() => {
    setShareUrl(settings.spotifyPodcastEmbedUrl)
  }, [settings.spotifyPodcastEmbedUrl])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = shareUrl.trim()

    if (trimmed.length === 0) {
      updateSettings({ spotifyPodcastEmbedUrl: '' })
      setError(null)
      return
    }

    if (!normalizeSpotifyPodcastEmbedUrl(trimmed)) {
      setError('Please paste a valid Spotify podcast show or episode link.')
      return
    }

    updateSettings({ spotifyPodcastEmbedUrl: trimmed })
    setError(null)
  }

  return (
    <div className={styles.widget}>
      <div
        className={[
          styles.embedArea,
          isLargeEmbed ? styles.embedAreaLarge : styles.embedAreaNormal,
        ].join(' ')}
      >
        <PodcastEmbedWidget
          title="Spotify Podcast"
          provider="spotify"
          shareUrl={settings.spotifyPodcastEmbedUrl}
          showHeader={false}
          showStatus={false}
          showActions={false}
          embedSize={isLargeEmbed ? 'large' : 'normal'}
          colorScheme={resolvedColorScheme}
        />
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        <input
          className={styles.input}
          type="url"
          placeholder="Paste Spotify podcast show or episode link"
          value={shareUrl}
          onChange={(event) => setShareUrl(event.target.value)}
        />
        <button className={styles.button} type="submit">Load</button>
      </form>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
