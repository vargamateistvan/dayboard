import { FormEvent, useEffect, useState } from 'react'
import { normalizeAppleMusicEmbedUrl } from '../lib/musicEmbeds'
import { useSettings } from '../lib/useSettings'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import styles from './AppleMusicWidget.module.css'

export function AppleMusicWidget() {
  const { settings, updateSettings } = useSettings()
  const [shareUrl, setShareUrl] = useState(settings.appleMusicEmbedUrl)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setShareUrl(settings.appleMusicEmbedUrl)
  }, [settings.appleMusicEmbedUrl])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = shareUrl.trim()

    if (trimmed.length === 0) {
      updateSettings({ appleMusicEmbedUrl: '' })
      setError(null)
      return
    }

    if (!normalizeAppleMusicEmbedUrl(trimmed)) {
      setError('Please paste a valid Apple Music album, playlist, song, or artist link.')
      return
    }

    updateSettings({ appleMusicEmbedUrl: trimmed })
    setError(null)
  }

  return (
    <div className={styles.widget}>
      <form className={styles.form} onSubmit={handleSave}>
        <input
          className={styles.input}
          type="url"
          placeholder="Paste Apple Music song / album / playlist link"
          value={shareUrl}
          onChange={(event) => setShareUrl(event.target.value)}
        />
        <button className={styles.button} type="submit">Load</button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      <MusicEmbedWidget
        title="Apple Music Player"
        provider="apple-music"
        shareUrl={settings.appleMusicEmbedUrl}
        showHeader={false}
        showStatus={false}
        showActions={false}
      />
    </div>
  )
}
