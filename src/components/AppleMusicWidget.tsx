import { useState, type ChangeEvent } from 'react'
import { normalizeAppleMusicEmbedUrl } from '../lib/musicEmbeds'
import {
  createSavedMediaLink,
  formatSavedLinkLabel,
  normalizeSavedMediaLinks,
  removeSavedMediaLink,
  resolveMediaLinkTitle,
} from '../lib/mediaLinks'
import { Trash2 } from 'lucide-react'
import { resolveColorScheme } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { MusicEmbedWidget } from './MusicEmbedWidget'
import { MediaBrandIcon } from './MediaBrandIcon'
import styles from './AppleMusicWidget.module.css'

interface AppleMusicWidgetProps {
  readonly isFullscreen?: boolean
}

export function AppleMusicWidget({ isFullscreen = false }: AppleMusicWidgetProps) {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const savedLinks = normalizeSavedMediaLinks(settings.appleMusicEmbedLinks, settings.appleMusicEmbedUrl)
  const activeUrl = settings.appleMusicEmbedUrl || savedLinks[0]?.url || ''
  const [addUrl, setAddUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const isLargeEmbed = placements.appleMusic?.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextUrl = event.target.value
    updateSettings({ appleMusicEmbedUrl: nextUrl })
    setError(null)
  }

  const handleRemoveSelected = () => {
    if (!activeUrl) return
    const nextLinks = removeSavedMediaLink(savedLinks, activeUrl)
    updateSettings({
      appleMusicEmbedUrl: nextLinks[0]?.url ?? '',
      appleMusicEmbedLinks: nextLinks,
    })
    setError(null)
  }

  const handleAddLink = () => {
    const trimmed = addUrl.trim()
    if (trimmed.length === 0) {
      setError(null)
      return
    }

    if (!normalizeAppleMusicEmbedUrl(trimmed)) {
      setError('Please paste a valid Apple Music album, playlist, song, or artist link.')
      return
    }

    setIsAdding(true)
    const title = resolveMediaLinkTitle(trimmed)
      const nextLinks = normalizeSavedMediaLinks([
        createSavedMediaLink(trimmed, title),
        ...savedLinks,
      ])
      updateSettings({
        appleMusicEmbedUrl: trimmed,
        appleMusicEmbedLinks: nextLinks,
      })
      setAddUrl('')
      setError(null)
    setIsAdding(false)
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
      <div
        className={[
          styles.embedArea,
          isFullscreen ? styles.embedAreaFullscreen : '',
          isLargeEmbed ? styles.embedAreaLarge : styles.embedAreaNormal,
        ].join(' ')}
      >
        <MusicEmbedWidget
          title="Apple Music Player"
          provider="apple-music"
          shareUrl={activeUrl}
          showHeader={false}
          showStatus={false}
          showActions={false}
          embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
          colorScheme={resolvedColorScheme}
        />
      </div>

      <label className={styles.selectorRow}>
        <span className={styles.labelRow}>
          <MediaBrandIcon brand="apple-music" size={18} className={styles.labelLogo} />
          <span>Saved links</span>
        </span>
        <div className={styles.selectRow}>
          <select
            className={styles.select}
            value={activeUrl}
            onChange={handleSelectChange}
            disabled={savedLinks.length === 0}
          >
            {savedLinks.length === 0 ? (
              <option value="">No saved links yet</option>
            ) : (
              savedLinks.map((entry) => (
                <option key={entry.url} value={entry.url}>
                  {formatSavedLinkLabel(entry)}
                </option>
              ))
            )}
          </select>
          <button
            className={styles.removeButton}
            type="button"
            onClick={handleRemoveSelected}
            disabled={!activeUrl}
            aria-label="Remove selected saved link"
            title="Remove selected saved link"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </label>

      <label className={styles.selectorRow}>
        <span className={styles.labelRow}>
          <MediaBrandIcon brand="apple-music" size={18} className={styles.labelLogo} />
          <span>Add link</span>
        </span>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            type="url"
            placeholder="Paste another Apple Music song / album / playlist link"
            value={addUrl}
            onChange={(event) => setAddUrl(event.target.value)}
          />
          <button className={styles.button} type="button" onClick={handleAddLink} disabled={isAdding}>
            {isAdding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </label>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
