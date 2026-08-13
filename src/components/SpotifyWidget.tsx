import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
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
import { fetchSpotifyAccountSnapshot, type SpotifyAccountSnapshot } from '../lib/spotifyApi'
import { getStoredSpotifyAuth, onSpotifyAuthChanged } from '../lib/spotifyAuth'
import styles from './SpotifyWidget.module.css'

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean
}

export function SpotifyWidget({ isFullscreen = false }: SpotifyWidgetProps) {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const savedLinks = normalizeSavedMediaLinks(settings.spotifyEmbedLinks, settings.spotifyEmbedUrl)
  const activeUrl = settings.spotifyEmbedUrl || savedLinks[0]?.url || ''
  const [addUrl, setAddUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [spotifyState, setSpotifyState] = useState<SpotifyAccountSnapshot | null>(null)
  const [spotifyStateLoading, setSpotifyStateLoading] = useState(false)
  const [spotifyStateError, setSpotifyStateError] = useState<string | null>(null)
  const isLargeEmbed = placements.spotify.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)

  useEffect(() => {
    let cancelled = false

    const syncSpotifyAccount = async () => {
      const auth = getStoredSpotifyAuth()
      if (!auth) {
        if (!cancelled) {
          setSpotifyState(null)
          setSpotifyStateError(null)
          setSpotifyStateLoading(false)
        }
        return
      }

      if (!cancelled) {
        setSpotifyStateLoading(true)
        setSpotifyStateError(null)
      }

      try {
        const snapshot = await fetchSpotifyAccountSnapshot(auth)
        if (!cancelled) {
          setSpotifyState(snapshot)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSpotifyState(null)
          setSpotifyStateError(loadError instanceof Error ? loadError.message : 'Failed to load Spotify data.')
        }
      } finally {
        if (!cancelled) {
          setSpotifyStateLoading(false)
        }
      }
    }

    const stopListening = onSpotifyAuthChanged(() => {
      void syncSpotifyAccount()
    })

    void syncSpotifyAccount()
    const intervalId = window.setInterval(() => {
      void syncSpotifyAccount()
    }, 60_000)

    return () => {
      cancelled = true
      stopListening()
      window.clearInterval(intervalId)
    }
  }, [])

  const spotifyConnected = Boolean(spotifyState)
  const spotifyDisplayName = spotifyState?.profile.display_name?.trim() || spotifyState?.profile.id || ''
  const spotifyPlayback = spotifyState?.playback ?? null
  const spotifyNowPlaying = useMemo(() => {
    if (!spotifyPlayback?.item) {
      return null
    }

    if (spotifyPlayback.item.type === 'track') {
      return {
        title: spotifyPlayback.item.name,
        subtitle: spotifyPlayback.item.artists.map((artist) => artist.name).join(', '),
        detail: spotifyPlayback.item.album.name,
        href: spotifyPlayback.item.external_urls.spotify,
        durationMs: spotifyPlayback.item.duration_ms,
      }
    }

    return {
      title: spotifyPlayback.item.name,
      subtitle: spotifyPlayback.item.show.name,
      detail: spotifyPlayback.item.show.publisher,
      href: spotifyPlayback.item.external_urls.spotify,
      durationMs: spotifyPlayback.item.duration_ms,
    }
  }, [spotifyPlayback])

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

  const handleAddLink = async () => {
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
     const title = await resolveMediaLinkTitle(trimmed)
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
   <div className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
     {spotifyConnected && (
       <section className={styles.accountCard}>
         <div className={styles.accountHeader}>
           <div>
             <div className={styles.accountLabel}>Connected Spotify</div>
             <div className={styles.accountName}>{spotifyDisplayName}</div>
           </div>
           <div className={styles.accountBadge}>{spotifyPlayback?.is_playing ? 'Playing' : 'Connected'}</div>
         </div>

         {spotifyStateLoading && <div className={styles.accountHint}>Refreshing Spotify status…</div>}
         {spotifyStateError && <div className={styles.error}>{spotifyStateError}</div>}

         {!spotifyStateLoading && !spotifyStateError && spotifyNowPlaying && (
           <div className={styles.nowPlaying}>
             <div className={styles.nowPlayingRow}>
               <div className={styles.nowPlayingMain}>
                 <div className={styles.nowPlayingTitle}>{spotifyNowPlaying.title}</div>
                 <div className={styles.nowPlayingSubtitle}>
                   {spotifyNowPlaying.subtitle}
                   {spotifyNowPlaying.detail ? ` · ${spotifyNowPlaying.detail}` : ''}
                 </div>
               </div>
               <a
                 className={styles.nowPlayingLink}
                 href={spotifyNowPlaying.href}
                 target="_blank"
                 rel="noreferrer"
               >
                 Open in Spotify
               </a>
             </div>
             <div className={styles.progressTrack} aria-hidden="true">
               <div
                 className={styles.progressFill}
                 style={{
                   width: `${Math.min(
                     100,
                     Math.max(
                       0,
                       spotifyNowPlaying.durationMs > 0
                         ? ((spotifyPlayback?.progress_ms ?? 0) / spotifyNowPlaying.durationMs) * 100
                         : 0,
                     ),
                   )}%`,
                 }}
               />
             </div>
           </div>
         )}

         {!spotifyStateLoading && !spotifyStateError && !spotifyNowPlaying && (
           <div className={styles.accountHint}>
             {spotifyPlayback?.is_playing
               ? 'Spotify is connected, but playback details are unavailable right now.'
               : 'Spotify is connected, but nothing is playing right now.'}
           </div>
         )}
       </section>
     )}

     <div
       className={[
         styles.embedArea,
         isFullscreen ? styles.embedAreaFullscreen : '',
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
          embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
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
