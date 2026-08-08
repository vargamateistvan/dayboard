import { useState, type ChangeEvent } from 'react'
import { normalizeSpotifyEmbedUrl } from '../lib/musicEmbeds'
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
import styles from './SpotifyWidget.module.css'

export function SpotifyWidget() {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const savedLinks = normalizeSavedMediaLinks(settings.spotifyEmbedLinks, settings.spotifyEmbedUrl)
  const activeUrl = settings.spotifyEmbedUrl || savedLinks[0]?.url || ''
  const [addUrl, setAddUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const isLargeEmbed = placements.spotify.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextUrl = event.target.value
    updateSettings({ spotifyEmbedUrl: nextUrl })
    setError(null)
  }

  const handleRemoveSelected = () => {
    if (!activeUrl) return
    const nextLinks = removeSavedMediaLink(savedLinks, activeUrl)
    updateSettings({
     spotifyEmbedUrl: nextLinks[0]?.url ?? '',
     spotifyEmbedLinks: nextLinks,
    })
    setError(null)
  }

  const handleAddLink = () => {
    const trimmed = addUrl.trim()
    if (trimmed.length === 0) {
     setError(null)
     return
    }

    if (!normalizeSpotifyEmbedUrl(trimmed)) {
     setError('Please paste a valid Spotify track, album, playlist, artist, show or episode link.')
     return
    }

    setIsAdding(true)
    const title = resolveMediaLinkTitle(trimmed)
     const nextLinks = normalizeSavedMediaLinks([
       createSavedMediaLink(trimmed, title),
       ...savedLinks,
     ])
     updateSettings({
       spotifyEmbedUrl: trimmed,
       spotifyEmbedLinks: nextLinks,
     })
     setAddUrl('')
     setError(null)
     setIsAdding(false)
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
          shareUrl={activeUrl}
          showHeader={false}
          showStatus={false}
          showActions={false}
          embedSize={isLargeEmbed ? 'large' : 'normal'}
          colorScheme={resolvedColorScheme}
        />
      </div>

      <label className={styles.selectorRow}>
        <span className={styles.labelRow}>
          <MediaBrandIcon brand="spotify" size={18} className={styles.labelLogo} />
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
          <MediaBrandIcon brand="spotify" size={18} className={styles.labelLogo} />
          <span>Add link</span>
        </span>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            type="url"
            placeholder="Paste another Spotify track / album / playlist link"
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
