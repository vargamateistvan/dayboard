import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { SpotifyIframePlayer } from './SpotifyIframePlayer'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme } from '../lib/settings'
import {
  fetchSpotifyAccountSnapshot,
  fetchSpotifyArtistSnapshot,
  searchSpotifyCatalog,
  type SpotifyAccountSnapshot,
  type SpotifyArtistSnapshot,
  type SpotifySavedAlbumItem,
  type SpotifyTopArtistItem,
  type SpotifyTopTrackItem,
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

function extractSpotifyArtistId(value: string): string | null {
  const match = value.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/)
  return match?.[1] ?? null
}

function formatTopArtist(item: SpotifyTopArtistItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: 'Top artist',
  }
}

function formatTopTrack(item: SpotifyTopTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
  }
}

function formatSavedAlbum(item: SpotifySavedAlbumItem): SpotifySelection {
  return {
    url: item.album.external_urls.spotify,
    title: item.album.name,
    subtitle: item.album.artists.map((artist) => artist.name).join(' · '),
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

function getCountLabel(count: number, emptyLabel: string): string {
  return count > 0 ? `${count}` : emptyLabel
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
  const [autocompleteResults, setAutocompleteResults] = useState<SpotifySearchResults | null>(null)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null)
  const [artistSnapshot, setArtistSnapshot] = useState<SpotifyArtistSnapshot | null>(null)
  const [artistLoading, setArtistLoading] = useState(false)
  const [artistError, setArtistError] = useState<string | null>(null)
  const isLargeEmbed = placements.spotify.rowSpan >= 2

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
          setAutocompleteResults(null)
          setAutocompleteLoading(false)
          setAutocompleteError(null)
          setArtistSnapshot(null)
          setArtistLoading(false)
          setArtistError(null)
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
  const library = spotifyState?.library

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

  useEffect(() => {
    const auth = getStoredSpotifyAuth()
    const trimmedQuery = searchQuery.trim()

    if (!auth || trimmedQuery.length < 2) {
      setAutocompleteResults(null)
      setAutocompleteLoading(false)
      setAutocompleteError(null)
      return
    }

    let cancelled = false
    setAutocompleteLoading(true)
    setAutocompleteError(null)

    const timer = window.setTimeout(() => {
      void searchSpotifyCatalog(auth, trimmedQuery)
        .then((results) => {
          if (!cancelled) {
            setAutocompleteResults(results)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setAutocompleteResults(null)
            setAutocompleteError(error instanceof Error ? error.message : 'Failed to load autocomplete.')
          }
        })
        .finally(() => {
          if (!cancelled) {
            setAutocompleteLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const handleUseSelection = (selection: SpotifySelection) => {
    setSearchQuery(selection.title)
    setSelectedSelection(selection)
    const artistId = extractSpotifyArtistId(selection.url)
    if (artistId) {
      setArtistLoading(true)
      setArtistError(null)
      const auth = getStoredSpotifyAuth()
      if (auth) {
        void fetchSpotifyArtistSnapshot(auth, artistId)
          .then((snapshot) => {
            setArtistSnapshot(snapshot)
          })
          .catch((error: unknown) => {
            setArtistSnapshot(null)
            setArtistError(error instanceof Error ? error.message : 'Failed to load artist details.')
          })
          .finally(() => {
            setArtistLoading(false)
          })
      }
    } else {
      setArtistSnapshot(null)
      setArtistLoading(false)
      setArtistError(null)
    }
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
                  title={activeSelection?.title ?? 'Spotify player'}
                  subtitle={
                    activeSelection?.subtitle ??
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
                  <span className={styles.spotifyPill}>
                    {getPlaylistCountLabel(searchResults ?? { tracks: [], albums: [], playlists: [] })}
                  </span>
                </div>
                <div className={styles.autocompleteWrap}>
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
                  {autocompleteLoading ? <div className={styles.connectHint}>Searching as you type…</div> : null}
                  {autocompleteError ? <div className={styles.error}>{autocompleteError}</div> : null}
                  {searchQuery.trim().length >= 2 && autocompleteResults ? (
                    <div className={styles.autocompletePanel}>
                      {autocompleteResults.tracks.slice(0, 3).map((item) => (
                        <SearchResultButton
                          key={item.external_urls.spotify}
                          label={formatSearchTrack(item)}
                          artworkUrl={item.album.images[0]?.url}
                          fallbackBrand="spotify"
                          onSelect={handleUseSelection}
                        />
                      ))}
                      {autocompleteResults.albums.slice(0, 2).map((item) => (
                        <SearchResultButton
                          key={item.external_urls.spotify}
                          label={formatSearchAlbum(item)}
                          artworkUrl={item.images[0]?.url}
                          fallbackBrand="spotify"
                          onSelect={handleUseSelection}
                        />
                      ))}
                      {autocompleteResults.playlists.slice(0, 2).map((item) => (
                        <SearchResultButton
                          key={item.external_urls.spotify}
                          label={formatSearchPlaylist(item)}
                          artworkUrl={item.images[0]?.url}
                          fallbackBrand="spotify"
                          onSelect={handleUseSelection}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                {searchError && <div className={styles.error}>{searchError}</div>}
              </form>

              {library ? (
                <div className={styles.librarySection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Your Spotify library</span>
                  </div>
                  <div className={styles.libraryGrid}>
                    <LibraryGroup
                      title="Top tracks"
                      countLabel={getCountLabel(library.topTracks.length, 'No tracks')}
                      items={library.topTracks.map((item) => ({
                        label: formatTopTrack(item),
                        artworkUrl: item.album.images[0]?.url,
                      }))}
                      onSelect={handleUseSelection}
                    />
                    <LibraryGroup
                      title="Top artists"
                      countLabel={getCountLabel(library.topArtists.length, 'No artists')}
                      items={library.topArtists.map((item) => ({
                        label: formatTopArtist(item),
                        artworkUrl: item.images[0]?.url,
                      }))}
                      onSelect={handleUseSelection}
                    />
                    <LibraryGroup
                      title="Playlists"
                      countLabel={getCountLabel(library.playlists.length, 'No playlists')}
                      items={library.playlists.map((item) => ({
                        label: formatSearchPlaylist(item),
                        artworkUrl: item.images[0]?.url,
                      }))}
                      onSelect={handleUseSelection}
                    />
                    <LibraryGroup
                      title="Saved albums"
                      countLabel={getCountLabel(library.savedAlbums.length, 'No albums')}
                      items={library.savedAlbums.map((item) => ({
                        label: formatSavedAlbum(item),
                        artworkUrl: item.album.images[0]?.url,
                      }))}
                      onSelect={handleUseSelection}
                    />
                  </div>
                </div>
              ) : null}

              {artistSnapshot ? (
                <div className={styles.librarySection}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>Artist focus</span>
                    <span className={styles.spotifyPill}>Top tracks</span>
                  </div>
                  <div className={styles.artistHero}>
                    <div className={styles.artistHeroImage}>
                      {artistSnapshot.artist.images[0]?.url ? (
                        <img
                          className={styles.resultImage}
                          src={artistSnapshot.artist.images[0].url}
                          alt=""
                        />
                      ) : (
                        <MediaBrandIcon brand="spotify" size={20} />
                      )}
                    </div>
                    <div className={styles.artistHeroCopy}>
                      <div className={styles.artistHeroTitle}>{artistSnapshot.artist.name}</div>
                      <div className={styles.artistHeroSubtitle}>Tap a top track to load it in the player</div>
                    </div>
                  </div>
                  {artistLoading ? <div className={styles.connectHint}>Loading artist tracks…</div> : null}
                  {artistError ? <div className={styles.error}>{artistError}</div> : null}
                  <div className={styles.resultList}>
                    {artistSnapshot.topTracks.slice(0, 5).map((item) => (
                      <SearchResultButton
                        key={item.external_urls.spotify}
                        label={formatTopTrack(item)}
                        artworkUrl={item.album.images[0]?.url}
                        fallbackBrand="spotify"
                        onSelect={handleUseSelection}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

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

interface LibraryGroupProps {
  readonly title: string
  readonly countLabel: string
  readonly items: Array<{
    label: SpotifySelection
    artworkUrl?: string
  }>
  readonly onSelect: (selection: SpotifySelection) => void
}

function LibraryGroup({ title, countLabel, items, onSelect }: LibraryGroupProps) {
  return (
    <section className={styles.libraryGroup}>
      <div className={styles.sectionHeader}>
        <span className={styles.resultGroupTitle}>{title}</span>
        <span className={styles.spotifyPill}>{countLabel}</span>
      </div>
      <div className={styles.resultList}>
        {items.slice(0, 5).map((item) => (
          <SearchResultButton
            key={item.label.url}
            label={item.label}
            artworkUrl={item.artworkUrl}
            fallbackBrand="spotify"
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
