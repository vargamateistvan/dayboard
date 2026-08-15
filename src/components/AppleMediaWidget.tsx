import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bookmark, Search, Trash2 } from 'lucide-react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme, type Settings } from '../lib/settings'
import {
  createSavedMediaLink,
  formatSavedLinkLabel,
  normalizeSavedMediaLinks,
  removeSavedMediaLink,
  resolveMediaLinkTitle,
  type SavedMediaLink,
} from '../lib/mediaLinks'
import type { AppleCatalogItem } from '../lib/appleSearchApi'
import styles from './SpotifyWidget.module.css'
import appleStyles from './AppleMediaWidget.module.css'

const SEARCH_DEBOUNCE_MS = 450
const SEARCH_MIN_QUERY_LENGTH = 2
const SEARCH_CACHE_TTL_MS = 45_000

export interface AppleCatalogGroup {
  readonly title: string
  readonly items: AppleCatalogItem[]
}

export interface AppleMediaConfig {
  readonly brand: 'apple-music' | 'apple-podcasts'
  readonly title: string
  readonly subtitle: string
  readonly placementKey: 'appleMusic' | 'applePodcast'
  readonly urlSettingKey: 'appleMusicEmbedUrl' | 'applePodcastEmbedUrl'
  readonly linksSettingKey: 'appleMusicEmbedLinks' | 'applePodcastEmbedLinks'
  readonly normalizeUrl: (value: string) => string | null
  readonly search: (query: string) => Promise<AppleCatalogGroup[]>
  readonly searchPlaceholder: string
  readonly searchHint: string
  readonly addPlaceholder: string
  readonly invalidLinkMessage: string
  readonly renderEmbed: (props: {
    shareUrl: string
    embedSize: 'normal' | 'large' | 'fullscreen'
    colorScheme: 'light' | 'dark'
  }) => ReactNode
}

interface AppleMediaWidgetProps {
  readonly config: AppleMediaConfig
  readonly isFullscreen?: boolean
}

type AppleBrowseTab = 'search' | 'saved'

interface ResultRowProps {
  readonly brand: AppleMediaConfig['brand']
  readonly item: AppleCatalogItem
  readonly className?: string
  readonly onPlay: (item: AppleCatalogItem) => void
}

function ResultRow({ brand, item, className, onPlay }: ResultRowProps) {
  return (
    <button
      type="button"
      className={[styles.resultButton, className ?? ''].join(' ')}
      onClick={() => onPlay(item)}
    >
      <div className={styles.resultArtwork}>
        {item.artworkUrl ? (
          <img className={styles.resultImage} src={item.artworkUrl} alt="" />
        ) : (
          <MediaBrandIcon brand={brand} size={16} />
        )}
      </div>
      <div className={styles.resultCopy}>
        <div className={styles.resultTitle}>{item.title}</div>
        <div className={styles.resultSubtitle}>{item.subtitle}</div>
      </div>
    </button>
  )
}

interface ResultGroupProps {
  readonly brand: AppleMediaConfig['brand']
  readonly title: string
  readonly items: AppleCatalogItem[]
  readonly onPlay: (item: AppleCatalogItem) => void
}

function ResultGroup({ brand, title, items, onPlay }: ResultGroupProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className={styles.libraryCollection}>
      <div className={styles.resultGroupTitle}>{title}</div>
      <div className={[styles.resultList, styles.scrollList].join(' ')}>
        {items.map((item) => (
          <ResultRow key={item.url} brand={brand} item={item} onPlay={onPlay} />
        ))}
      </div>
    </div>
  )
}

export function AppleMediaWidget({ config, isFullscreen = false }: AppleMediaWidgetProps) {
  const { settings, updateSettings } = useSettings()
  const { placements } = useWidgetVisibility()
  const savedLinks = normalizeSavedMediaLinks(
    settings[config.linksSettingKey],
    settings[config.urlSettingKey],
  )
  const activeUrl = settings[config.urlSettingKey] || savedLinks[0]?.url || ''
  const [activeTab, setActiveTab] = useState<AppleBrowseTab>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchGroups, setSearchGroups] = useState<AppleCatalogGroup[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addUrl, setAddUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const searchCacheRef = useRef<Map<string, { expiresAt: number; groups: AppleCatalogGroup[] }>>(
    new Map(),
  )
  const isLargeEmbed = placements[config.placementKey]?.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)
  const embedSize = isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'

  const applySelection = (url: string, title?: string | null) => {
    const nextLinks = normalizeSavedMediaLinks([
      createSavedMediaLink(url, title),
      ...savedLinks,
    ])
    updateSettings({
      [config.urlSettingKey]: url,
      [config.linksSettingKey]: nextLinks,
    } as Partial<Settings>)
  }

  const handlePlay = (item: AppleCatalogItem) => {
    applySelection(item.url, item.title)
  }

  const handlePlaySaved = (link: SavedMediaLink) => {
    updateSettings({ [config.urlSettingKey]: link.url } as Partial<Settings>)
  }

  const handleRemoveSaved = (link: SavedMediaLink) => {
    const nextLinks = removeSavedMediaLink(savedLinks, link.url)
    updateSettings({
      [config.urlSettingKey]:
        activeUrl === link.url ? (nextLinks[0]?.url ?? '') : activeUrl,
      [config.linksSettingKey]: nextLinks,
    } as Partial<Settings>)
  }

  const handleAddLink = async () => {
    const trimmed = addUrl.trim()
    if (trimmed.length === 0) {
      setAddError(null)
      return
    }

    if (!config.normalizeUrl(trimmed)) {
      setAddError(config.invalidLinkMessage)
      return
    }

    setIsAdding(true)
    const title = await resolveMediaLinkTitle(trimmed)
    applySelection(trimmed, title)
    setAddUrl('')
    setAddError(null)
    setIsAdding(false)
  }

  const runSearch = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim()
      if (trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
        setSearchGroups(null)
        setSearchError(null)
        setSearchLoading(false)
        return
      }

      const cacheKey = trimmedQuery.toLowerCase()
      const cached = searchCacheRef.current.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        setSearchGroups(cached.groups)
        setSearchError(null)
        setSearchLoading(false)
        return
      }

      setSearchLoading(true)
      setSearchError(null)

      void config
        .search(trimmedQuery)
        .then((groups) => {
          searchCacheRef.current.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            groups,
          })
          setSearchGroups(groups)
        })
        .catch((error: unknown) => {
          setSearchGroups(null)
          setSearchError(
            error instanceof Error ? error.message : 'Failed to search the Apple catalog.',
          )
        })
        .finally(() => {
          setSearchLoading(false)
        })
    },
    [config],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchQuery, runSearch])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runSearch(searchQuery)
  }

  const groups = searchGroups ?? []
  const hasSearchResults = groups.some((group) => group.items.length > 0)

  const tabs: Array<{ id: AppleBrowseTab; label: string; Icon: typeof Search }> = [
    { id: 'search', label: 'Search', Icon: Search },
    { id: 'saved', label: 'Saved', Icon: Bookmark },
  ]

  return (
    <div className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
      <section className={styles.spotifyShell}>
        <header className={styles.spotifyHeader}>
          <div className={styles.spotifyIdentity}>
            <div className={styles.spotifyAvatar}>
              <MediaBrandIcon brand={config.brand} size={18} className={styles.spotifyLogo} />
            </div>
            <div className={styles.spotifyIdentityCopy}>
              <div className={styles.spotifyTitle}>{config.title}</div>
              <div className={styles.spotifySubtitle}>{config.subtitle}</div>
            </div>
          </div>
          <div className={styles.spotifyPills}>
            <span className={styles.spotifyPill}>Embedded player</span>
          </div>
        </header>

        <div className={styles.spotifyLayout}>
          <div className={styles.playerPane}>
            <div
              className={[
                styles.embedArea,
                embedSize === 'fullscreen'
                  ? styles.embedAreaFullscreen
                  : embedSize === 'large'
                    ? styles.embedAreaLarge
                    : styles.embedAreaNormal,
              ].join(' ')}
            >
              {config.renderEmbed({
                shareUrl: activeUrl,
                embedSize,
                colorScheme: resolvedColorScheme,
              })}
            </div>
          </div>

          <aside className={styles.spotifySidebar}>
            <div className={styles.tabRow} role="tablist" aria-label={`Browse ${config.title}`}>
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  className={[
                    styles.tabButton,
                    activeTab === id ? styles.tabButtonActive : '',
                  ].join(' ')}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'search' ? (
              <form className={styles.searchPanel} onSubmit={handleSearchSubmit}>
                <div className={styles.searchRow}>
                  <input
                    className={styles.input}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={config.searchPlaceholder}
                    aria-label={`Search ${config.title}`}
                  />
                  <button className={styles.button} type="submit" disabled={searchLoading}>
                    {searchLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {searchError ? <div className={styles.error}>{searchError}</div> : null}
                {hasSearchResults ? (
                  <div className={styles.libraryCollections}>
                    {groups.map((group) => (
                      <ResultGroup
                        key={group.title}
                        brand={config.brand}
                        title={group.title}
                        items={group.items}
                        onPlay={handlePlay}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.connectHint}>
                    {searchQuery.trim().length >= SEARCH_MIN_QUERY_LENGTH && !searchLoading
                      ? 'No results found.'
                      : config.searchHint}
                  </div>
                )}
              </form>
            ) : null}

            {activeTab === 'saved' ? (
              <div className={styles.librarySection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Saved links</span>
                  {savedLinks.length ? (
                    <span className={styles.spotifyPill}>{savedLinks.length}</span>
                  ) : null}
                </div>
                {savedLinks.length ? (
                  <div className={[styles.resultList, styles.scrollList].join(' ')}>
                    {savedLinks.map((link) => (
                      <div key={link.url} className={appleStyles.savedRow}>
                        <button
                          type="button"
                          className={[
                            styles.resultButton,
                            appleStyles.savedRowButton,
                            link.url === activeUrl ? appleStyles.savedRowActive : '',
                          ].join(' ')}
                          onClick={() => handlePlaySaved(link)}
                        >
                          <div className={styles.resultArtwork}>
                            <MediaBrandIcon brand={config.brand} size={16} />
                          </div>
                          <div className={styles.resultCopy}>
                            <div className={styles.resultTitle}>
                              {formatSavedLinkLabel(link)}
                            </div>
                            <div className={styles.resultSubtitle}>
                              {link.url === activeUrl ? 'Now playing' : 'Tap to play'}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={appleStyles.removeButton}
                          onClick={() => handleRemoveSaved(link)}
                          aria-label={`Remove ${formatSavedLinkLabel(link)}`}
                          title="Remove saved link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.connectHint}>
                    No saved links yet. Search the catalog or paste a link below.
                  </div>
                )}
                <div className={appleStyles.addForm}>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder={config.addPlaceholder}
                    value={addUrl}
                    onChange={(event) => setAddUrl(event.target.value)}
                  />
                  <button
                    className={styles.button}
                    type="button"
                    onClick={handleAddLink}
                    disabled={isAdding}
                  >
                    {isAdding ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {addError ? <div className={styles.error}>{addError}</div> : null}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  )
}
