import { useState, type ChangeEvent } from 'react'
import { normalizeApplePodcastEmbedUrl } from '../lib/musicEmbeds'
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
import { MediaBrandIcon } from './MediaBrandIcon'
import styles from './SpotifyWidget.module.css'

const DEFAULT_APPLE_PODCAST_URL = 'https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272'

interface ApplePodcastWidgetProps {
  readonly isFullscreen?: boolean
}

export function ApplePodcastWidget({ isFullscreen = false }: ApplePodcastWidgetProps) {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const savedLinks = normalizeSavedMediaLinks(
    settings.applePodcastEmbedLinks,
    settings.applePodcastEmbedUrl,
  )
  const activeUrl = settings.applePodcastEmbedUrl || savedLinks[0]?.url || ''
  const [addUrl, setAddUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const isLargeEmbed = placements.applePodcast?.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextUrl = event.target.value
    updateSettings({ applePodcastEmbedUrl: nextUrl })
    setError(null)
  }

  const handleRemoveSelected = () => {
    if (!activeUrl) return
    const nextLinks = removeSavedMediaLink(savedLinks, activeUrl)
    updateSettings({
      applePodcastEmbedUrl: nextLinks[0]?.url ?? '',
      applePodcastEmbedLinks: nextLinks,
    })
    setError(null)
  }

  const handleAddLink = () => {
    const trimmed = addUrl.trim()
    if (trimmed.length === 0) {
      setError(null)
      return
    }

    if (!normalizeApplePodcastEmbedUrl(trimmed)) {
      setError('Please paste a valid Apple Podcast show or episode link.')
      return
    }

    setIsAdding(true)
    const title = resolveMediaLinkTitle(trimmed)
    const nextLinks = normalizeSavedMediaLinks([
      createSavedMediaLink(trimmed, title),
      ...savedLinks,
    ])
    updateSettings({
      applePodcastEmbedUrl: trimmed,
      applePodcastEmbedLinks: nextLinks,
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
        {(() => {
          const resolvedUrl = activeUrl || DEFAULT_APPLE_PODCAST_URL
          const embedUrl = normalizeApplePodcastEmbedUrl(resolvedUrl)
          if (!embedUrl) return null
          const themed = new URL(embedUrl)
          themed.searchParams.set('theme', resolvedColorScheme)
          return (
            <iframe
              style={{ display: 'block', width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-sm)' }}
              src={themed.toString()}
              title="Apple Podcast"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )
        })()}
      </div>

      <label className={styles.selectorRow}>
        <span className={styles.labelRow}>
          <MediaBrandIcon brand="apple-podcasts" size={18} className={styles.labelLogo} />
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
          <MediaBrandIcon brand="apple-podcasts" size={18} className={styles.labelLogo} />
          <span>Add link</span>
        </span>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            type="url"
            placeholder="Paste another Apple Podcast show or episode link"
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
