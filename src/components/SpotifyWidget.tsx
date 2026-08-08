import { FormEvent, useEffect, useState } from 'react'
import { normalizeSpotifyEmbedUrl } from '../lib/musicEmbeds'
import { resolveColorScheme } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import styles from './SpotifyWidget.module.css'

export function SpotifyWidget() {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const [shareUrl, setShareUrl] = useState(settings.spotifyEmbedUrl)
  const [error, setError] = useState<string | null>(null)
  const isLargeEmbed = placements.spotify.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  useEffect(() => {
    setShareUrl(settings.spotifyEmbedUrl)
  }, [settings.spotifyEmbedUrl])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = shareUrl.trim()

    if (trimmed.length === 0) {
      updateSettings({ spotifyEmbedUrl: '' })
      setError(null)
      return
    }

    if (!normalizeSpotifyEmbedUrl(trimmed)) {
      setError('Please paste a valid Spotify track, album, playlist, artist, show or episode link.')
      return
    }

    updateSettings({ spotifyEmbedUrl: trimmed })
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
        <MusicEmbedWidget
          title="Spotify Player"
          provider="spotify"
          shareUrl={settings.spotifyEmbedUrl}
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
          placeholder="Paste Spotify track / album / playlist link"
          value={shareUrl}
          onChange={(event) => setShareUrl(event.target.value)}
        />
        <button className={styles.button} type="submit">Load</button>
      </form>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
