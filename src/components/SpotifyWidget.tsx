import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Laptop } from 'lucide-react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { SpotifyIframePlayer } from './SpotifyIframePlayer'
import { SpotifyWebPlayer } from './SpotifyWebPlayer'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme } from '../lib/settings'
import {
  fetchSpotifyAccountSnapshot,
  fetchSpotifyArtistSnapshot,
  pauseSpotifyPlayback,
  resumeSpotifyPlayback,
  searchSpotifyCatalog,
  skipToNextSpotifyTrack,
  skipToPreviousSpotifyTrack,
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
import {
  clearStoredSpotifyAuth,
  getStoredSpotifyAuth,
  onSpotifyAuthChanged,
  startSpotifyLogin,
  type SpotifyAuthSession,
} from '../lib/spotifyAuth'
import styles from './SpotifyWidget.module.css'

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean
}

type SpotifySelection = {
  readonly url: string
  readonly title: string
  readonly subtitle: string
  readonly artworkUrl?: string
}

function formatPlaybackSummary(snapshot: SpotifyAccountSnapshot | null): SpotifySelection | null {
  const item = snapshot?.playback?.item
  if (!item) {
    const firstRecentWithTrack = snapshot?.recentlyPlayed?.find(
      (recentlyPlayedItem) => Boolean(recentlyPlayedItem.track?.external_urls.spotify),
    )
    return firstRecentWithTrack ? formatRecentSummary(firstRecentWithTrack) : null
  }

  if (item.type === 'track') {
    return {
      url: item.external_urls.spotify,
      title: item.name,
      subtitle: item.artists.map((artist) => artist.name).join(' · '),
      artworkUrl: item.album.images[0]?.url,
    }
  }

  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: `${item.show.name} · ${item.show.publisher}`,
  }
}

function formatRecentSummary(item: SpotifyRecentPlayedItem): SpotifySelection | null {
  if (!item.track?.external_urls.spotify) {
    return null
  }

  return {
    url: item.track.external_urls.spotify,
    title: item.track.name,
    subtitle: item.track.artists.map((artist) => artist.name).join(' · '),
    artworkUrl: item.track.album.images[0]?.url,
  }
}

function formatSearchTrack(item: SpotifySearchTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
    artworkUrl: item.album.images[0]?.url,
  }
}

function formatSearchAlbum(item: SpotifySearchAlbumItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
    artworkUrl: item.images[0]?.url,
  }
}

function formatSearchPlaylist(item: SpotifySearchPlaylistItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.owner.display_name ?? `${item.tracks.total} tracks`,
    artworkUrl: item.images[0]?.url,
  }
}

function extractSpotifyArtistId(value: string): string | null {
  const match = value.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/)
  return match?.[1] ?? null
}

function formatTopTrack(item: SpotifyTopTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(' · '),
    artworkUrl: item.album.images[0]?.url,
  }
}

function formatTopArtist(item: SpotifyTopArtistItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: 'Top artist',
    artworkUrl: item.images[0]?.url,
  }
}

function formatSavedAlbum(item: SpotifySavedAlbumItem): SpotifySelection {
  return {
    url: item.album.external_urls.spotify,
    title: item.album.name,
    subtitle: item.album.artists.map((artist) => artist.name).join(' · '),
    artworkUrl: item.album.images[0]?.url,
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

const SPOTIFY_ACCOUNT_REFRESH_MS = 120_000
const SPOTIFY_AUTOCOMPLETE_DEBOUNCE_MS = 500
const SPOTIFY_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3
const SPOTIFY_SEARCH_CACHE_TTL_MS = 45_000

function parseSpotifyRateLimitSeconds(message: string): number | null {
  const retryMatch = message.match(/Retry after (\d+) seconds/i)
  if (retryMatch?.[1]) {
    return Math.max(1, Number.parseInt(retryMatch[1], 10))
  }

  if (/rate limit|too many requests|429/i.test(message)) {
    return 30
  }

  return null
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
  const [controlLoading, setControlLoading] = useState(false)
  const [controlError, setControlError] = useState<string | null>(null)
  const [authSession, setAuthSession] = useState<SpotifyAuthSession | null>(() => getStoredSpotifyAuth())
  const [browserPlaybackEnabled, setBrowserPlaybackEnabled] = useState(false)
  const spotifyRateLimitUntilRef = useRef(0)
  const searchCacheRef = useRef<Map<string, { expiresAt: number; results: SpotifySearchResults }>>(new Map())
  const skipNextAutocompleteRef = useRef(false)
  const isLargeEmbed = placements.spotify.rowSpan >= 2

  useEffect(() => {
    let cancelled = false

    const syncSpotifyAccount = async () => {
      if (Date.now() < spotifyRateLimitUntilRef.current) {
        return
      }

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
          const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load Spotify data.'
        const rateLimitSeconds = parseSpotifyRateLimitSeconds(errorMessage)
        if (rateLimitSeconds) {
          spotifyRateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000
          setSpotifyStateError(`Spotify rate limit reached. Retrying in ${rateLimitSeconds}s.`)
          return
        }
        if (errorMessage.includes('Insufficient client scope')) {
          clearStoredSpotifyAuth()
          setConnectError('Spotify permissions changed. Please reconnect Spotify.')
            setSpotifyStateError(null)
            return
          }
          setSpotifyState(null)
          setSpotifyStateError(errorMessage)
        }
      } finally {
        if (!cancelled) {
          setSpotifyStateLoading(false)
        }
      }
    }

    let hadAuth = Boolean(getStoredSpotifyAuth())
    const stopListening = onSpotifyAuthChanged(() => {
      const hasAuth = Boolean(getStoredSpotifyAuth())
      // Token refreshes (e.g. from the Web Playback SDK) fire this event too,
      // but the account snapshot only needs refetching when we connect or
      // disconnect. Ignoring refresh-only changes avoids request storms.
      if (hasAuth === hadAuth) {
        return
      }
      hadAuth = hasAuth
      void syncSpotifyAccount()
    })

    void syncSpotifyAccount()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return
      }
      void syncSpotifyAccount()
    }, SPOTIFY_ACCOUNT_REFRESH_MS)

    return () => {
      cancelled = true
      stopListening()
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const updateAuthSession = () => {
      setAuthSession((previous) => {
        const next = getStoredSpotifyAuth()
        // Preserve the previous object identity across token refreshes so the
        // Web Playback SDK player is not torn down and reconnected repeatedly.
        if (previous?.refreshToken && previous.refreshToken === next?.refreshToken) {
          return previous
        }
        return next
      })
    }
    updateAuthSession()
    return onSpotifyAuthChanged(updateAuthSession)
  }, [])

  const isConnected = Boolean(spotifyState)
  const liveSelection = useMemo(() => formatPlaybackSummary(spotifyState), [spotifyState])
  const activeSelection = selectedSelection ?? liveSelection
  const profileName = spotifyState?.profile.display_name ?? spotifyState?.profile.id ?? 'Spotify'
  const deviceLabel = spotifyState?.playback?.device?.name ?? 'This browser'
  const livePlaybackItem = spotifyState?.playback?.item ?? null
  const livePlaybackUrl = livePlaybackItem?.external_urls.spotify ?? ''
  const isLivePlaybackSelection = Boolean(activeSelection?.url && activeSelection.url === livePlaybackUrl)
  const currentProgressMs = isLivePlaybackSelection ? spotifyState?.playback?.progress_ms ?? null : null
  const currentDurationMs = isLivePlaybackSelection ? livePlaybackItem?.duration_ms ?? null : null
  const isCurrentlyPlaying = isLivePlaybackSelection ? Boolean(spotifyState?.playback?.is_playing) : false
  const canControlPlayback = isLivePlaybackSelection && Boolean(spotifyState?.playback?.device)
  const library = spotifyState?.library
  const topTrackItems = useMemo(
    () =>
      (library?.topTracks ?? []).filter(
        (track): track is SpotifyTopTrackItem =>
          typeof track.external_urls.spotify === 'string' && track.external_urls.spotify.length > 0,
      ),
    [library?.topTracks],
  )
  const topArtistItems = useMemo(
    () =>
      (library?.topArtists ?? []).filter(
        (artist): artist is SpotifyTopArtistItem =>
          typeof artist.external_urls.spotify === 'string' && artist.external_urls.spotify.length > 0,
      ),
    [library?.topArtists],
  )
  const playlistItems = useMemo(
    () =>
      (library?.playlists ?? []).filter(
        (playlist): playlist is SpotifySearchPlaylistItem =>
          typeof playlist.external_urls.spotify === 'string' && playlist.external_urls.spotify.length > 0,
      ),
    [library?.playlists],
  )
  const savedAlbumItems = useMemo(
    () =>
      (library?.savedAlbums ?? []).filter(
        (savedAlbum): savedAlbum is SpotifySavedAlbumItem =>
          typeof savedAlbum.album.external_urls.spotify === 'string' &&
          savedAlbum.album.external_urls.spotify.length > 0,
      ),
    [library?.savedAlbums],
  )
  const recentPlayedItems = useMemo(
    () =>
      (spotifyState?.recentlyPlayed ?? [])
        .map((item) => {
          const selection = formatRecentSummary(item)
          if (!selection) {
            return null
          }

          return {
            playedAt: item.played_at,
            selection,
            artworkUrl: item.track?.album.images[0]?.url,
          }
        })
        .filter((item): item is { playedAt: string; selection: SpotifySelection; artworkUrl: string | undefined } => item !== null)
        .slice(0, 3),
    [spotifyState?.recentlyPlayed],
  )

  const handleConnectSpotify = () => {
    setConnectError(null)
    void startSpotifyLogin().catch((error: unknown) => {
      setConnectError(error instanceof Error ? error.message : 'Spotify login failed.')
    })
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (Date.now() < spotifyRateLimitUntilRef.current) {
      const waitSeconds = Math.max(1, Math.ceil((spotifyRateLimitUntilRef.current - Date.now()) / 1000))
      setSearchError(`Spotify rate limit reached. Try again in ${waitSeconds}s.`)
      return
    }

    const auth = getStoredSpotifyAuth()
    if (!auth) {
      return
    }

    const trimmedQuery = searchQuery.trim()
    const queryCacheKey = trimmedQuery.toLowerCase()
    if (!trimmedQuery) {
      setSearchResults(null)
      setSearchError(null)
      return
    }

    setSearchLoading(true)
    setSearchError(null)

    try {
      const now = Date.now()
      const cached = searchCacheRef.current.get(queryCacheKey)
      const results =
        cached && cached.expiresAt > now
          ? cached.results
          : await searchSpotifyCatalog(auth, trimmedQuery)
      if (!cached || cached.expiresAt <= now) {
        searchCacheRef.current.set(queryCacheKey, {
          expiresAt: now + SPOTIFY_SEARCH_CACHE_TTL_MS,
          results,
        })
      }
      setSearchResults(results)
    } catch (error) {
      setSearchResults(null)
      const message = error instanceof Error ? error.message : 'Failed to search Spotify.'
      const rateLimitSeconds = parseSpotifyRateLimitSeconds(message)
      if (rateLimitSeconds) {
        spotifyRateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000
      }
      setSearchError(message)
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    const auth = getStoredSpotifyAuth()
    const trimmedQuery = searchQuery.trim()
    const queryCacheKey = trimmedQuery.toLowerCase()

    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false
      setAutocompleteResults(null)
      setAutocompleteLoading(false)
      setAutocompleteError(null)
      return
    }

    if (!auth || trimmedQuery.length < SPOTIFY_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      setAutocompleteResults(null)
      setAutocompleteLoading(false)
      setAutocompleteError(null)
      return
    }

    let cancelled = false
    setAutocompleteLoading(true)
    setAutocompleteError(null)

    const timer = window.setTimeout(() => {
      if (Date.now() < spotifyRateLimitUntilRef.current) {
        setAutocompleteLoading(false)
        return
      }

      const now = Date.now()
      const cached = searchCacheRef.current.get(queryCacheKey)
      if (cached && cached.expiresAt > now) {
        setAutocompleteResults(cached.results)
        setAutocompleteLoading(false)
        return
      }

      void searchSpotifyCatalog(auth, trimmedQuery)
        .then((results) => {
          if (!cancelled) {
            searchCacheRef.current.set(queryCacheKey, {
              expiresAt: Date.now() + SPOTIFY_SEARCH_CACHE_TTL_MS,
              results,
            })
            setAutocompleteResults(results)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : 'Failed to load autocomplete.'
            const rateLimitSeconds = parseSpotifyRateLimitSeconds(message)
            if (rateLimitSeconds) {
              spotifyRateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000
            }
            setAutocompleteResults(null)
            setAutocompleteError(message)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setAutocompleteLoading(false)
          }
        })
    }, SPOTIFY_AUTOCOMPLETE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const handleUseSelection = (selection: SpotifySelection) => {
    setControlError(null)
    skipNextAutocompleteRef.current = true
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

  const refreshSpotifyPlayback = async () => {
    const auth = getStoredSpotifyAuth()
    if (!auth) {
      setSpotifyState(null)
      return
    }

    const snapshot = await fetchSpotifyAccountSnapshot(auth)
    setSpotifyState(snapshot)
  }

  const handlePlaybackControl = async (
    action: (auth: SpotifyAuthSession) => Promise<void>,
  ) => {
    const auth = getStoredSpotifyAuth()
    if (!auth) {
      setControlError('Spotify session expired. Please reconnect Spotify.')
      return
    }

    if (Date.now() < spotifyRateLimitUntilRef.current) {
      const waitSeconds = Math.max(1, Math.ceil((spotifyRateLimitUntilRef.current - Date.now()) / 1000))
      setControlError(`Spotify rate limit reached. Try again in ${waitSeconds}s.`)
      return
    }

    setControlLoading(true)
    setControlError(null)
    try {
      await action(auth)
      await refreshSpotifyPlayback()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to control Spotify playback.'
      const rateLimitSeconds = parseSpotifyRateLimitSeconds(message)
      if (rateLimitSeconds) {
        spotifyRateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000
      }
      if (message.includes('Insufficient client scope')) {
        clearStoredSpotifyAuth()
        setConnectError('Spotify permissions changed. Please reconnect Spotify.')
        setSpotifyStateError(null)
        setControlError(null)
        return
      }
      setControlError(message)
    } finally {
      setControlLoading(false)
    }
  }

  const handlePrevious = () => {
    void handlePlaybackControl(skipToPreviousSpotifyTrack)
  }

  const handleTogglePlay = () => {
    const action = isCurrentlyPlaying ? pauseSpotifyPlayback : resumeSpotifyPlayback
    void handlePlaybackControl(action)
  }

  const handleNext = () => {
    void handlePlaybackControl(skipToNextSpotifyTrack)
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
            <div className={styles.playerPane}>
              {isConnected && authSession ? (
                <div className={styles.browserPlayerToggleRow}>
                  <button
                    type="button"
                    className={[
                      styles.browserPlayerToggle,
                      browserPlaybackEnabled ? styles.browserPlayerToggleActive : '',
                    ].join(' ')}
                    onClick={() => setBrowserPlaybackEnabled((enabled) => !enabled)}
                    aria-pressed={browserPlaybackEnabled}
                  >
                    <Laptop size={13} />
                    {browserPlaybackEnabled ? 'Browser player on' : 'Play in browser'}
                  </button>
                </div>
              ) : null}

              {browserPlaybackEnabled && authSession ? (
                <SpotifyWebPlayer
                  auth={authSession}
                  enabled={browserPlaybackEnabled}
                  colorScheme={resolveColorScheme(settings.colorScheme)}
                  embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
                  selectionUrl={activeSelection?.url}
                  selectionLabel={activeSelection?.title}
                />
              ) : (
                <>
                  {spotifyStateLoading && <div className={styles.connectHint}>Refreshing Spotify…</div>}
                  {spotifyStateError && <div className={styles.error}>{spotifyStateError}</div>}
                  {!spotifyStateError && activeSelection ? (
                    <SpotifyIframePlayer
                      sourceUrl={activeSelection.url}
                      title={activeSelection.title}
                      subtitle={activeSelection.subtitle}
                      artworkUrl={activeSelection.artworkUrl}
                      isPlaying={isCurrentlyPlaying}
                      progressMs={currentProgressMs}
                      durationMs={currentDurationMs}
                      isLivePlayback={isLivePlaybackSelection}
                      controlsDisabled={!canControlPlayback || controlLoading}
                      onPrevious={handlePrevious}
                      onTogglePlay={handleTogglePlay}
                      onNext={handleNext}
                      embedSize={isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'}
                      colorScheme={resolveColorScheme(settings.colorScheme)}
                    />
                  ) : null}
                  {controlError ? <div className={styles.error}>{controlError}</div> : null}
                  {!spotifyStateLoading && !spotifyStateError && !activeSelection ? (
                    <div className={styles.connectHint}>Open Spotify and start playing to show the player.</div>
                  ) : null}
                </>
              )}
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
                    <span className={styles.spotifyPill}>
                      {topTrackItems.length + topArtistItems.length + playlistItems.length + savedAlbumItems.length}
                    </span>
                  </div>
                  <div className={styles.libraryCollections}>
                    <div className={styles.libraryCollection}>
                      <div className={styles.resultGroupTitle}>Top tracks</div>
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
                        {topTrackItems.map((item) => (
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
                    <div className={styles.libraryCollection}>
                      <div className={styles.resultGroupTitle}>Top artists</div>
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
                        {topArtistItems.map((item) => (
                          <SearchResultButton
                            key={item.external_urls.spotify}
                            label={formatTopArtist(item)}
                            artworkUrl={item.images[0]?.url}
                            fallbackBrand="spotify"
                            onSelect={handleUseSelection}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={styles.libraryCollection}>
                      <div className={styles.resultGroupTitle}>Playlists</div>
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
                        {playlistItems.map((item) => (
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
                    <div className={styles.libraryCollection}>
                      <div className={styles.resultGroupTitle}>Saved albums</div>
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
                        {savedAlbumItems.map((item) => (
                          <SearchResultButton
                            key={item.album.external_urls.spotify}
                            label={formatSavedAlbum(item)}
                            artworkUrl={item.album.images[0]?.url}
                            fallbackBrand="spotify"
                            onSelect={handleUseSelection}
                          />
                        ))}
                      </div>
                    </div>
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
                  <div className={[styles.resultList, styles.scrollList].join(' ')}>
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
                  {recentPlayedItems.length ? (
                    <span className={styles.spotifyPill}>{recentPlayedItems.length}</span>
                  ) : null}
                </div>
                <div className={[styles.resultList, styles.scrollList].join(' ')}>
                  {recentPlayedItems.map((item) => (
                    <button
                      key={`${item.playedAt}-${item.selection.url}`}
                      type="button"
                      className={styles.resultButton}
                      onClick={() => handleUseSelection(item.selection)}
                    >
                      <div className={styles.resultArtwork}>
                        {item.artworkUrl ? (
                          <img className={styles.resultImage} src={item.artworkUrl} alt="" />
                        ) : (
                          <MediaBrandIcon brand="spotify" size={16} />
                        )}
                      </div>
                      <div className={styles.resultCopy}>
                        <div className={styles.resultTitle}>{item.selection.title}</div>
                        <div className={styles.resultSubtitle}>
                          {item.selection.subtitle} · {formatRelativeTime(item.playedAt)}
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
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
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
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
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
                      <div className={[styles.resultList, styles.scrollList].join(' ')}>
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
