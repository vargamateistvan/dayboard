import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { SpotifyIframePlayer } from './SpotifyIframePlayer'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme } from '../lib/settings'
import {
  fetchSpotifyAccountSnapshot,
  searchSpotifyCatalog,
  type SpotifyAccountSnapshot,
  type SpotifyRecentPlayedItem,
  type SpotifySearchAlbumItem,
  type SpotifySearchPlaylistItem,
  type SpotifySearchResults,
  type SpotifySearchTrackItem,
} from '../lib/spotifyApi'
import { getStoredSpotifyAuth, onSpotifyAuthChanged, startSpotifyLogin } from '../lib/spotifyAuth'
import styles from './SpotifyWidget.module.css'

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean
}

type SpotifySelection = {
  readonly url: string
  readonly title: string
  readonly subtitle: string
}

function formatPlaybackSummary(snapshot: SpotifyAccountSnapshot | null): SpotifySelection | null {
  const item = snapshot?.playback?.item
  if (!item) {
    return snapshot?.recentlyPlayed?.[0]
      ? formatRecentSummary(snapshot.recentlyPlayed[0])
      : null
  }

  if (item.type === 'track') {
    return {
      url: item.external_urls.spotify,
      title: item.name,
      subtitle: item.artists.map((artist) => artist.name).join(' · '),
    }
  }

  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: `${item.show.name} · ${item.show.publisher}`,
  }
}

function formatRecentSummary(item: SpotifyRecentPlayedItem): SpotifySelection {
  return {
    url: item.track.external_urls.spotify,
    title: item.track.name,
    subtitle: item.track.artists.map((artist) => artist.name).join(' · '),
  }
}

function formatSearchTrack(item: SpotifySearchTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
  }
}

function formatSearchAlbum(item: SpotifySearchAlbumItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
  }
}

function formatSearchPlaylist(item: SpotifySearchPlaylistItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.owner.display_name ?? `${item.tracks.total} tracks`,
  }
}

function formatRelativeTime(iso: string): string {
  const deltaMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (deltaMinutes <= 1) {
    return 'just now'
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) {
    return `${deltaHours}h ago`
  }

  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays}d ago`
}

function getPlaylistCountLabel(results: SpotifySearchResults): string {
  const counts = [results.tracks.length, results.albums.length, results.playlists.length]
  return counts.some((count) => count > 0)
    ? `${counts.reduce((sum, count) => sum + count, 0)} results`
    : 'No results yet'
}

export function SpotifyWidget({ isFullscreen = false }: SpotifyWidgetProps) {
  const { settings } = useSettings()
  const { placements } = useWidgetVisibility()
  const [spotifyState, setSpotifyState] = useState<SpotifyAccountSnapshot | null>(null)
  const [spotifyStateLoading, setSpotifyStateLoading] = useState(false)
  const [spotifyStateError, setSpotifyStateError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [selectedSelection, setSelectedSelection] = useState<SpotifySelection | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifySearchResults | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
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
          setSelectedSelection(null)
          setSearchResults(null)
          setSearchError(null)
          setSearchLoading(false)
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

  const isConnected = Boolean(spotifyState)
  const liveSelection = useMemo(() => formatPlaybackSummary(spotifyState), [spotifyState])
  const activeSelection = selectedSelection ?? liveSelection
  const activePlayerUrl = activeSelection?.url ?? ''
  const profileName = spotifyState?.profile.display_name ?? spotifyState?.profile.id ?? 'Spotify'
  const deviceLabel = spotifyState?.playback?.device?.name ?? 'This browser'

  const handleConnectSpotify = () => {
    setConnectError(null)
    void startSpotifyLogin().catch((error: unknown) => {
      setConnectError(error instanceof Error ? error.message : 'Spotify login failed.')
    })
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const auth = getStoredSpotifyAuth()
    if (!auth) {
      return
    }

    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) {
      setSearchResults(null)
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    setSearchError(null)

    try {
      const results = await searchSpotifyCatalog(auth, trimmedQuery)
      setSearchResults(results)
    } catch (error) {
      setSearchResults(null)
      setSearchError(error instanceof Error ? error.message : 'Failed to search Spotify.')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleUseSelection = (selection: SpotifySelection) => {
    setSelectedSelection(selection)
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
      {!isConnected ? (
        <section className={styles.connectCard}>
          <button className={styles.connectButton} type="button" onClick={handleConnectSpotify}>
            <MediaBrandIcon brand="spotify" size={14} className={styles.connectIcon} />
            <span>Connect Spotify</span>
          </button>
          <p className={styles.connectHint}>Connect Spotify to show the player here.</p>
          {connectError && <div className={styles.error}>{connectError}</div>}
        </section>
      ) : (
        <section className={styles.spotifyShell}>
          <header className={styles.spotifyHeader}>
            <div className={styles.spotifyIdentity}>
              <div className={styles.spotifyAvatar}>
                <MediaBrandIcon brand="spotify" size={18} className={styles.spotifyLogo} />
              </div>
              <div className={styles.spotifyIdentityCopy}>
                <div className={styles.spotifyTitle}>Spotify</div>
                <div className={styles.spotifySubtitle}>{profileName}</div>
              </div>
            </div>
            <div className={styles.spotifyPills}>
              <span className={styles.spotifyPill}>Connected</span>
              <span className={styles.spotifyPill}>{deviceLabel}</span>
            </div>
          </header>

          <div className={styles.spotifyLayout}>
            <div className={[styles.embedArea, isFullscreen ? styles.embedAreaFullscreen : '', isLargeEmbed ? styles.embedAreaLarge : styles.embedAreaNormal].join(' ')}>
              {selectedSelection ? (
                <div className={styles.spotifySelectionBar}>
                  <span className={styles.spotifySelectionText}>
                    Showing {selectedSelection.title}
                  </span>
                  <button
                    className={styles.actionButton}
                    type="button"
                    onClick={() => setSelectedSelection(null)}
                  >
                    Back to live
                  </button>
                </div>
              ) : null}
              {spotifyStateLoading && <div className={styles.connectHint}>Refreshing Spotify…</div>}
              {spotifyStateError && <div className={styles.error}>{spotifyStateError}</div>}
              {!spotifyStateLoading && !spotifyStateError && activePlayerUrl ? (
                <SpotifyIframePlayer
                  sourceUrl={activePlayerUrl}
                  title={selectedSelection?.title ?? 'Spotify player'}
                  subtitle={
                    selectedSelection?.subtitle ??
                    'Open Spotify and start playing to show the player.'
                  }
                  embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
                  colorScheme={resolveColorScheme(settings.colorScheme)}
                />
              ) : null}
              {!spotifyStateLoading && !spotifyStateError && !activePlayerUrl ? (
                <div className={styles.connectHint}>Open Spotify and start playing to show the player.</div>
              ) : null}
            </div>

            <aside className={styles.spotifySidebar}>
              <form className={styles.searchPanel} onSubmit={handleSearch}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Search Spotify</span>
                  <span className={styles.spotifyPill}>{getPlaylistCountLabel(searchResults ?? { tracks: [], albums: [], playlists: [] })}</span>
                </div>
                <div className={styles.searchRow}>
                  <input
                    className={styles.input}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Tracks, albums, or playlists"
                  />
                  <button className={styles.button} type="submit" disabled={searchLoading}>
                    {searchLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {searchError && <div className={styles.error}>{searchError}</div>}
              </form>

              <div className={styles.librarySection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Recently played</span>
                  {spotifyState?.recentlyPlayed?.length ? (
                    <span className={styles.spotifyPill}>{spotifyState.recentlyPlayed.length}</span>
                  ) : null}
                </div>
                <div className={styles.resultList}>
                  {(spotifyState?.recentlyPlayed ?? []).slice(0, 3).map((item) => (
                    <button
                      key={`${item.played_at}-${item.track.external_urls.spotify}`}
                      type="button"
                      className={styles.resultButton}
                      onClick={() => handleUseSelection(formatRecentSummary(item))}
                    >
                      <div className={styles.resultArtwork}>
                        {item.track.album.images[0]?.url ? (
                          <img className={styles.resultImage} src={item.track.album.images[0].url} alt="" />
                        ) : (
                          <MediaBrandIcon brand="spotify" size={16} />
                        )}
                      </div>
                      <div className={styles.resultCopy}>
                        <div className={styles.resultTitle}>{item.track.name}</div>
                        <div className={styles.resultSubtitle}>
                          {item.track.artists.map((artist) => artist.name).join(' · ')} · {formatRelativeTime(item.played_at)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {(searchResults?.tracks.length || searchResults?.albums.length || searchResults?.playlists.length) ? (
                <div className={styles.librarySection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Search results</span>
                  </div>

                  {searchResults?.tracks.length ? (
                    <div className={styles.resultGroup}>
                      <div className={styles.resultGroupTitle}>Tracks</div>
                      <div className={styles.resultList}>
                        {searchResults.tracks.map((item) => (
                          <SearchResultButton
                            key={item.external_urls.spotify}
                            label={formatSearchTrack(item)}
                            artworkUrl={item.album.images[0]?.url}
                            fallbackBrand="spotify"
                            onSelect={handleUseSelection}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {searchResults?.albums.length ? (
                    <div className={styles.resultGroup}>
                      <div className={styles.resultGroupTitle}>Albums</div>
                      <div className={styles.resultList}>
                        {searchResults.albums.map((item) => (
                          <SearchResultButton
                            key={item.external_urls.spotify}
                            label={formatSearchAlbum(item)}
                            artworkUrl={item.images[0]?.url}
                            fallbackBrand="spotify"
                            onSelect={handleUseSelection}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {searchResults?.playlists.length ? (
                    <div className={styles.resultGroup}>
                      <div className={styles.resultGroupTitle}>Playlists</div>
                      <div className={styles.resultList}>
                        {searchResults.playlists.map((item) => (
                          <SearchResultButton
                            key={item.external_urls.spotify}
                            label={formatSearchPlaylist(item)}
                            artworkUrl={item.images[0]?.url}
                            fallbackBrand="spotify"
                            onSelect={handleUseSelection}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      )}
    </div>
  )
}

interface SearchResultButtonProps {
  readonly label: SpotifySelection
  readonly artworkUrl?: string
  readonly fallbackBrand: 'spotify'
  readonly onSelect: (selection: SpotifySelection) => void
}

function SearchResultButton({ label, artworkUrl, fallbackBrand, onSelect }: SearchResultButtonProps) {
  return (
    <button type="button" className={styles.resultButton} onClick={() => onSelect(label)}>
      <div className={styles.resultArtwork}>
        {artworkUrl ? (
          <img className={styles.resultImage} src={artworkUrl} alt="" />
        ) : (
          <MediaBrandIcon brand={fallbackBrand} size={16} />
        )}
      </div>
      <div className={styles.resultCopy}>
        <div className={styles.resultTitle}>{label.title}</div>
        <div className={styles.resultSubtitle}>{label.subtitle}</div>
      </div>
    </button>
  )
}
