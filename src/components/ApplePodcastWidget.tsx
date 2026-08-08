import { FormEvent, useEffect, useState } from 'react'
import { normalizeApplePodcastEmbedUrl } from '../lib/musicEmbeds'
import { useSettings } from '../lib/useSettings'
import { PodcastEmbedWidget } from './PodcastEmbedWidget'
import styles from './SpotifyWidget.module.css'

export function ApplePodcastWidget() {
  const { settings, updateSettings } = useSettings()
  const [shareUrl, setShareUrl] = useState(settings.applePodcastEmbedUrl)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setShareUrl(settings.applePodcastEmbedUrl)
  }, [settings.applePodcastEmbedUrl])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = shareUrl.trim()

    if (trimmed.length === 0) {
      updateSettings({ applePodcastEmbedUrl: '' })
      setError(null)
      return
    }

    if (!normalizeApplePodcastEmbedUrl(trimmed)) {
      setError('Please paste a valid Apple Podcast show or episode link.')
      return
    }

    updateSettings({ applePodcastEmbedUrl: trimmed })
    setError(null)
  }

  return (
    <div className={styles.widget}>
      <PodcastEmbedWidget
        title="Apple Podcast"
        provider="apple-podcast"
        shareUrl={settings.applePodcastEmbedUrl}
        showHeader={false}
        showStatus={false}
        showActions={false}
      />

      <form className={styles.form} onSubmit={handleSave}>
        <input
          className={styles.input}
          type="url"
          placeholder="Paste Apple Podcast show or episode link"
          value={shareUrl}
          onChange={(event) => setShareUrl(event.target.value)}
        />
        <button className={styles.button} type="submit">Load</button>
      </form>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
