import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bookmark, Search, Trash2 } from 'lucide-react'
import { MediaBrandIcon } from './MediaBrandIcon'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { resolveColorScheme, type Settings } from '../lib/settings'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
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
const PRESS_ANIMATION_DURATION_MS = Math.max(80, MOTION_DURATIONS.quick - 50)

function getInteractiveButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null
  }
  const button = target.closest('button')
  return button instanceof HTMLButtonElement ? button : null
}

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
  const widgetRootRef = useRef<HTMLDivElement | null>(null)
  const playerPaneRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const tabRowRef = useRef<HTMLDivElement | null>(null)
  const tabIndicatorRef = useRef<HTMLSpanElement | null>(null)
  const lastActiveUrlRef = useRef<string | null>(null)
  const searchCacheRef = useRef<Map<string, { expiresAt: number; groups: AppleCatalogGroup[] }>>(
    new Map(),
  )
  const isLargeEmbed = placements[config.placementKey]?.rowSpan >= 2
  const resolvedColorScheme = resolveColorScheme(settings.colorScheme)
  const embedSize = isFullscreen ? 'fullscreen' : isLargeEmbed ? 'large' : 'normal'
  // Song and episode links carry an `i=<id>` query param; their embeds render
  // a fixed 175px player. Collection embeds (album/playlist/show/artist) max
  // out at 450px of real content, so anything taller shows white filler.
  const isItemEmbed = /[?&]i=\d/.test(activeUrl)
  const embedSizeClass = isItemEmbed
    ? appleStyles.embedAreaItem
    : embedSize === 'normal'
      ? styles.embedAreaNormal
      : appleStyles.embedAreaCollection

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

  const groups = searchGroups ?? []
  const hasSearchResults = groups.some((group) => group.items.length > 0)
  const showAppleMusicEmbedNotice = config.brand === 'apple-music'
  const openAppleMusicUrl = activeUrl.trim() || 'https://music.apple.com/'
  const searchResultTotal = groups.reduce((sum, group) => sum + group.items.length, 0)
  const listAnimationSignature = `${activeTab}:${searchResultTotal}:${savedLinks.length}:${activeUrl}`

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const rootNode = widgetRootRef.current
    if (!rootNode) {
      return
    }

    let cancelled = false
    let activeAnimations: Array<{ cancel?: () => void }> = []

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }

      const targets = [
        rootNode.querySelector(`.${styles.spotifyHeader}`),
        rootNode.querySelector(`.${styles.playerPane}`),
        rootNode.querySelector(`.${styles.spotifySidebar}`),
      ]

      activeAnimations = targets
        .filter((target): target is Element => target instanceof Element)
        .map((target, index) =>
          anime.animate(target, {
            opacity: [0, 1],
            translateY: [12, 0],
            duration: MOTION_DURATIONS.short + 50,
            delay: index * MOTION_STAGGERS.normal,
          }),
        )
    })

    return () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
    }
  }, [config.brand])

  useEffect(() => {
    const tabRowNode = tabRowRef.current
    const tabIndicatorNode = tabIndicatorRef.current
    if (!tabRowNode || !tabIndicatorNode) {
      return
    }

    const placeIndicator = () => {
      const activeTabButton = tabRowNode.querySelector<HTMLButtonElement>(
        'button[role="tab"][aria-selected="true"]',
      )
      if (!activeTabButton) {
        return
      }
      tabIndicatorNode.style.width = `${activeTabButton.offsetWidth}px`
      tabIndicatorNode.style.transform = `translateX(${activeTabButton.offsetLeft}px)`
      tabIndicatorNode.style.opacity = '1'
    }

    placeIndicator()

    const resizeObserver = new ResizeObserver(() => {
      placeIndicator()
    })
    resizeObserver.observe(tabRowNode)
    window.addEventListener('resize', placeIndicator)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', placeIndicator)
    }
  }, [])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const tabRowNode = tabRowRef.current
    const tabIndicatorNode = tabIndicatorRef.current
    if (!tabRowNode || !tabIndicatorNode) {
      return
    }

    const activeTabButton = tabRowNode.querySelector<HTMLButtonElement>(
      'button[role="tab"][aria-selected="true"]',
    )
    if (!activeTabButton) {
      return
    }

    let cancelled = false
    let animation: { cancel?: () => void } | null = null

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }
      animation = anime.animate(tabIndicatorNode, {
        width: activeTabButton.offsetWidth,
        translateX: activeTabButton.offsetLeft,
        duration: MOTION_DURATIONS.short,
      })
    })

    return () => {
      cancelled = true
      animation?.cancel?.()
    }
  }, [activeTab])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const sidebarNode = sidebarRef.current
    if (!sidebarNode) {
      return
    }

    const panelNode = sidebarNode.querySelector(`[data-apple-tab-panel="${activeTab}"]`)
    if (!(panelNode instanceof Element)) {
      return
    }

    let cancelled = false
    let animation: { cancel?: () => void } | null = null

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }
      animation = anime.animate(panelNode, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: MOTION_DURATIONS.short,
      })
    })

    return () => {
      cancelled = true
      animation?.cancel?.()
    }
  }, [activeTab])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const sidebarNode = sidebarRef.current
    if (!sidebarNode) {
      return
    }

    const panelNode = sidebarNode.querySelector(`[data-apple-tab-panel="${activeTab}"]`)
    if (!(panelNode instanceof Element)) {
      return
    }

    const rowNodes = Array.from(panelNode.querySelectorAll(`.${styles.resultButton}`))
    if (!rowNodes.length) {
      return
    }

    let cancelled = false
    let activeAnimations: Array<{ cancel?: () => void }> = []

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }

      if (anime.stagger) {
        activeAnimations = [
          anime.animate(rowNodes, {
            opacity: [0, 1],
            translateX: [10, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ]
        return
      }

      activeAnimations = rowNodes.map((rowNode, index) =>
        anime.animate(rowNode, {
          opacity: [0, 1],
          translateX: [10, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      )
    })

    return () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
    }
  }, [activeTab, listAnimationSignature])

  useEffect(() => {
    if (!isMotionEnabled() || !activeUrl) {
      return
    }

    if (lastActiveUrlRef.current === activeUrl) {
      return
    }
    lastActiveUrlRef.current = activeUrl

    const paneNode = playerPaneRef.current
    if (!paneNode) {
      return
    }

    let cancelled = false
    let animation: { cancel?: () => void } | null = null

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }
      animation = anime.animate(paneNode, {
        scale: [0.99, 1],
        opacity: [0.94, 1],
        duration: MOTION_DURATIONS.short + 30,
      })
    })

    return () => {
      cancelled = true
      animation?.cancel?.()
    }
  }, [activeUrl])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const rootNode = widgetRootRef.current
    if (!rootNode) {
      return
    }

    const isInteractiveButton = (button: HTMLButtonElement) =>
      button.classList.contains(styles.tabButton) ||
      button.classList.contains(styles.resultButton) ||
      button.classList.contains(styles.button) ||
      button.classList.contains(appleStyles.removeButton)

    let cancelled = false

    const animateButton = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return
        }
        anime.animate(button, options)
      })
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }
      const button = getInteractiveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 1.015,
        translateY: -1,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target)
      if (!button || !isInteractiveButton(button)) {
        return
      }
      animateButton(button, {
        scale: 1,
        translateY: 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 0.98,
        translateY: 0,
        duration: PRESS_ANIMATION_DURATION_MS,
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: button.matches(':hover') ? 1.015 : 1,
        translateY: button.matches(':hover') ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    rootNode.addEventListener('pointerenter', handlePointerEnter, true)
    rootNode.addEventListener('pointerleave', handlePointerLeave, true)
    rootNode.addEventListener('pointerdown', handlePointerDown, true)
    rootNode.addEventListener('pointerup', handlePointerUp, true)
    rootNode.addEventListener('pointercancel', handlePointerUp, true)

    return () => {
      cancelled = true
      rootNode.removeEventListener('pointerenter', handlePointerEnter, true)
      rootNode.removeEventListener('pointerleave', handlePointerLeave, true)
      rootNode.removeEventListener('pointerdown', handlePointerDown, true)
      rootNode.removeEventListener('pointerup', handlePointerUp, true)
      rootNode.removeEventListener('pointercancel', handlePointerUp, true)
    }
  }, [])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runSearch(searchQuery)
  }

  const tabs: Array<{ id: AppleBrowseTab; label: string; Icon: typeof Search }> = [
    { id: 'search', label: 'Search', Icon: Search },
    { id: 'saved', label: 'Saved', Icon: Bookmark },
  ]

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.widgetFullscreen : ''].join(' ')}>
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
            <span className={styles.spotifyPill}>
              {showAppleMusicEmbedNotice ? 'Preview embed' : 'Embedded player'}
            </span>
          </div>
        </header>

        <div className={styles.spotifyLayout}>
          <div ref={playerPaneRef} className={styles.playerPane}>
            <div
              className={[styles.embedArea, appleStyles.embedHost, embedSizeClass].join(' ')}
            >
              {config.renderEmbed({
                shareUrl: activeUrl,
                // The outer card always owns the height now; the inner
                // widget's large/fullscreen min-heights would overflow it.
                embedSize: 'normal',
                colorScheme: resolvedColorScheme,
              })}
            </div>
            {showAppleMusicEmbedNotice ? (
              <div className={appleStyles.embedNotice}>
                <div className={styles.connectHint}>
                  Apple&apos;s embeddable player only exposes previews inside third-party
                  dashboards. Open the selection in Apple Music for full subscriber playback.
                </div>
                <a
                  className={[styles.connectButton, appleStyles.embedNoticeLink].join(' ')}
                  href={openAppleMusicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Apple Music
                </a>
              </div>
            ) : null}
          </div>

          <aside ref={sidebarRef} className={styles.spotifySidebar}>
            <div ref={tabRowRef} className={styles.tabRow} role="tablist" aria-label={`Browse ${config.title}`}>
              <span ref={tabIndicatorRef} aria-hidden="true" className={styles.tabIndicator} />
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
              <form className={styles.searchPanel} data-apple-tab-panel="search" onSubmit={handleSearchSubmit}>
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
              <div className={styles.librarySection} data-apple-tab-panel="saved">
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
