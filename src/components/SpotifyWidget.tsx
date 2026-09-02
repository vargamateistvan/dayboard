import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { History, Library, LogOut, Search } from "lucide-react";
import { MediaBrandIcon } from "./MediaBrandIcon";
import { SpotifyEmbedPlayer } from "./SpotifyEmbedPlayer";
import { useSettings } from "../lib/useSettings";
import { useWidgetVisibility } from "../lib/useWidgetVisibility";
import { resolveColorScheme } from "../lib/settings";
import {
  fetchSpotifyAccountSnapshot,
  searchSpotifyCatalog,
  type SpotifyAccountSnapshot,
  type SpotifyRecentPlayedItem,
  type SpotifySavedAlbumItem,
  type SpotifySavedShowItem,
  type SpotifySearchAlbumItem,
  type SpotifySearchEpisodeItem,
  type SpotifySearchPlaylistItem,
  type SpotifySearchResults,
  type SpotifySearchShowItem,
  type SpotifySearchTrackItem,
  type SpotifyTopArtistItem,
  type SpotifyTopTrackItem,
} from "../lib/spotifyApi";
import {
  clearStoredSpotifyAuth,
  getStoredSpotifyAuth,
  onSpotifyAuthChanged,
  startSpotifyLogin,
} from "../lib/spotifyAuth";
import {
  isMotionEnabled,
  loadAnimeJs,
  MOTION_DURATIONS,
  MOTION_STAGGERS,
} from "../lib/anime";
import styles from "./SpotifyWidget.module.css";

interface SpotifyWidgetProps {
  readonly isFullscreen?: boolean;
}

type SpotifyBrowseTab = "search" | "recent" | "library";

interface SpotifySelection {
  readonly url: string;
  readonly title: string;
  readonly subtitle: string;
  readonly artworkUrl?: string;
}

const EMPTY_SEARCH_RESULTS: SpotifySearchResults = {
  tracks: [],
  albums: [],
  playlists: [],
  shows: [],
  episodes: [],
};

function formatSearchTrack(item: SpotifySearchTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(" · "),
    artworkUrl: item.album.images[0]?.url,
  };
}

function formatSearchAlbum(item: SpotifySearchAlbumItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(" · "),
    artworkUrl: item.images[0]?.url,
  };
}

function formatSearchPlaylist(
  item: SpotifySearchPlaylistItem,
): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.owner.display_name ?? `${item.tracks.total} tracks`,
    artworkUrl: item.images[0]?.url,
  };
}

function formatSearchShow(item: SpotifySearchShowItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.publisher,
    artworkUrl: item.images[0]?.url,
  };
}

function formatSearchEpisode(item: SpotifySearchEpisodeItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.release_date ? `Episode · ${item.release_date}` : "Episode",
    artworkUrl: item.images[0]?.url,
  };
}

function formatTopTrack(item: SpotifyTopTrackItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: item.artists.map((artist) => artist.name).join(" · "),
    artworkUrl: item.album.images[0]?.url,
  };
}

function formatTopArtist(item: SpotifyTopArtistItem): SpotifySelection {
  return {
    url: item.external_urls.spotify,
    title: item.name,
    subtitle: "Top artist",
    artworkUrl: item.images[0]?.url,
  };
}

function formatSavedAlbum(item: SpotifySavedAlbumItem): SpotifySelection {
  return {
    url: item.album.external_urls.spotify,
    title: item.album.name,
    subtitle: item.album.artists.map((artist) => artist.name).join(" · "),
    artworkUrl: item.album.images[0]?.url,
  };
}

function formatSavedShow(item: SpotifySavedShowItem): SpotifySelection {
  return {
    url: item.show.external_urls.spotify,
    title: item.show.name,
    subtitle: item.show.publisher,
    artworkUrl: item.show.images[0]?.url,
  };
}

function formatRecent(item: SpotifyRecentPlayedItem): SpotifySelection | null {
  if (!item.track?.external_urls.spotify) {
    return null;
  }

  return {
    url: item.track.external_urls.spotify,
    title: item.track.name,
    subtitle: item.track.artists.map((artist) => artist.name).join(" · "),
    artworkUrl: item.track.album.images[0]?.url,
  };
}

function formatRelativeTime(iso: string): string {
  const deltaMinutes = Math.round(
    (Date.now() - new Date(iso).getTime()) / 60_000,
  );
  if (deltaMinutes <= 1) {
    return "just now";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

const SPOTIFY_ACCOUNT_REFRESH_MS = 120_000;
const SEARCH_DEBOUNCE_MS = 450;
const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_CACHE_TTL_MS = 45_000;
const RATE_LIMIT_STORAGE_KEY = "dayboard_spotify_rate_limit_until";
const NOW_PLAYING_ANIMATION_DURATION_MS = MOTION_DURATIONS.short + 20;

function getInteractiveButton(
  target: EventTarget | null,
): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const button = target.closest("button");
  return button instanceof HTMLButtonElement ? button : null;
}

function parseSpotifyRateLimitSeconds(message: string): number | null {
  const retryMatch = message.match(/Retry after (\d+) seconds/i);
  if (retryMatch?.[1]) {
    return Math.max(1, Number.parseInt(retryMatch[1], 10));
  }

  if (/rate limit|too many requests|429/i.test(message)) {
    return 30;
  }

  return null;
}

function readPersistedRateLimitUntil(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : 0;
  if (!Number.isFinite(parsed) || parsed <= Date.now()) {
    return 0;
  }
  return parsed;
}

function persistRateLimitUntil(until: number) {
  if (typeof window === "undefined") {
    return;
  }
  if (until > Date.now()) {
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, String(until));
  } else {
    window.localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  }
}

interface ResultRowProps {
  readonly selection: SpotifySelection;
  readonly meta?: string;
  readonly onPlay: (selection: SpotifySelection) => void;
}

function ResultRow({ selection, meta, onPlay }: ResultRowProps) {
  return (
    <button
      type="button"
      className={styles.resultButton}
      onClick={() => onPlay(selection)}
    >
      <div className={styles.resultArtwork}>
        {selection.artworkUrl ? (
          <img
            className={styles.resultImage}
            src={selection.artworkUrl}
            alt=""
          />
        ) : (
          <MediaBrandIcon brand="spotify" size={16} />
        )}
      </div>
      <div className={styles.resultCopy}>
        <div className={styles.resultTitle}>{selection.title}</div>
        <div className={styles.resultSubtitle}>
          {meta ? `${selection.subtitle} · ${meta}` : selection.subtitle}
        </div>
      </div>
    </button>
  );
}

interface ResultGroupProps {
  readonly title: string;
  readonly selections: SpotifySelection[];
  readonly onPlay: (selection: SpotifySelection) => void;
}

function ResultGroup({ title, selections, onPlay }: ResultGroupProps) {
  if (selections.length === 0) {
    return null;
  }

  return (
    <div className={styles.libraryCollection}>
      <div className={styles.resultGroupTitle}>{title}</div>
      <div className={[styles.resultList, styles.scrollList].join(" ")}>
        {selections.map((selection) => (
          <ResultRow
            key={selection.url}
            selection={selection}
            onPlay={onPlay}
          />
        ))}
      </div>
    </div>
  );
}

export function SpotifyWidget({ isFullscreen = false }: SpotifyWidgetProps) {
  const { settings } = useSettings();
  const { placements } = useWidgetVisibility();
  const [authSession, setAuthSession] = useState(() => getStoredSpotifyAuth());
  const [snapshot, setSnapshot] = useState<SpotifyAccountSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SpotifyBrowseTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<SpotifySearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [embedSelection, setEmbedSelection] = useState<SpotifySelection | null>(
    null,
  );
  const rateLimitUntilRef = useRef(readPersistedRateLimitUntil());
  const searchCacheRef = useRef<
    Map<string, { expiresAt: number; results: SpotifySearchResults }>
  >(new Map());
  const widgetRootRef = useRef<HTMLDivElement | null>(null);
  const playerPaneRef = useRef<HTMLDivElement | null>(null);
  const nowPlayingCardRef = useRef<HTMLDivElement | null>(null);
  const nowPlayingArtworkRef = useRef<HTMLDivElement | null>(null);
  const nowPlayingCopyRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const tabIndicatorRef = useRef<HTMLSpanElement | null>(null);
  const lastPlayerSelectionUrlRef = useRef<string | null>(null);
  const isLargeEmbed = placements.spotify.rowSpan >= 2;
  const primarySelectionUrl =
    embedSelection?.url ??
    snapshot?.recentlyPlayed?.[0]?.track?.external_urls.spotify ??
    null;
  const searchResultTotal =
    (searchResults?.tracks.length ?? 0) +
    (searchResults?.albums.length ?? 0) +
    (searchResults?.playlists.length ?? 0) +
    (searchResults?.shows.length ?? 0) +
    (searchResults?.episodes.length ?? 0);
  const libraryResultTotal =
    (snapshot?.library?.playlists.length ?? 0) +
    (snapshot?.library?.savedAlbums.length ?? 0) +
    (snapshot?.library?.savedShows.length ?? 0) +
    (snapshot?.library?.topTracks.length ?? 0) +
    (snapshot?.library?.topArtists.length ?? 0);
  const listAnimationSignature = [
    activeTab,
    searchResultTotal,
    snapshot?.recentlyPlayed?.length ?? 0,
    libraryResultTotal,
  ].join(":");
  const firstRecentPlayedItem = snapshot?.recentlyPlayed?.[0] ?? null;
  const fallbackRecentSelection = useMemo(
    () => (firstRecentPlayedItem ? formatRecent(firstRecentPlayedItem) : null),
    [firstRecentPlayedItem],
  );
  const activeSelection = embedSelection ?? fallbackRecentSelection;

  const accountProduct = snapshot?.profile.product ?? null;

  useEffect(() => {
    const updateAuthSession = () => {
      setAuthSession((previous) => {
        const next = getStoredSpotifyAuth();
        // Preserve the previous object identity across token refreshes so the
        // Web Playback SDK player is not torn down and reconnected repeatedly.
        if (
          previous?.refreshToken &&
          previous.refreshToken === next?.refreshToken
        ) {
          return previous;
        }
        return next;
      });
    };
    updateAuthSession();
    return onSpotifyAuthChanged(updateAuthSession);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncAccount = async () => {
      const auth = getStoredSpotifyAuth();
      if (!auth) {
        if (!cancelled) {
          setSnapshot(null);
          setSnapshotError(null);
          setSnapshotLoading(false);
          setSearchResults(null);
          setSearchError(null);
          setSearchLoading(false);
        }
        return;
      }

      if (Date.now() < rateLimitUntilRef.current) {
        if (!cancelled) {
          const waitSeconds = Math.max(
            1,
            Math.ceil((rateLimitUntilRef.current - Date.now()) / 1000),
          );
          setSnapshotError(
            `Spotify rate limit reached. Retrying in ${waitSeconds}s.`,
          );
        }
        return;
      }

      if (!cancelled) {
        setSnapshotLoading(true);
        setSnapshotError(null);
      }

      try {
        const nextSnapshot = await fetchSpotifyAccountSnapshot(auth);
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Spotify data.";
        const rateLimitSeconds = parseSpotifyRateLimitSeconds(message);
        if (rateLimitSeconds) {
          rateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000;
          persistRateLimitUntil(rateLimitUntilRef.current);
          setSnapshotError(
            `Spotify rate limit reached. Retrying in ${rateLimitSeconds}s.`,
          );
          return;
        }
        if (message.includes("Insufficient client scope")) {
          clearStoredSpotifyAuth();
          setConnectError(
            "Spotify permissions changed. Please reconnect Spotify.",
          );
          setSnapshotError(null);
          return;
        }
        setSnapshot(null);
        setSnapshotError(message);
      } finally {
        if (!cancelled) {
          setSnapshotLoading(false);
        }
      }
    };

    let hadAuth = Boolean(getStoredSpotifyAuth());
    const stopListening = onSpotifyAuthChanged(() => {
      const hasAuth = Boolean(getStoredSpotifyAuth());
      // Token refreshes fire this event too; the snapshot only needs
      // refetching when we connect or disconnect.
      if (hasAuth === hadAuth) {
        return;
      }
      hadAuth = hasAuth;
      void syncAccount();
    });

    void syncAccount();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void syncAccount();
    }, SPOTIFY_ACCOUNT_REFRESH_MS);

    return () => {
      cancelled = true;
      stopListening();
      window.clearInterval(intervalId);
    };
  }, []);

  const runSearch = (query: string): boolean => {
    const auth = getStoredSpotifyAuth();
    const trimmedQuery = query.trim();
    if (!auth || trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return false;
    }

    if (Date.now() < rateLimitUntilRef.current) {
      const waitSeconds = Math.max(
        1,
        Math.ceil((rateLimitUntilRef.current - Date.now()) / 1000),
      );
      setSearchError(
        `Spotify rate limit reached. Try again in ${waitSeconds}s.`,
      );
      setSearchLoading(false);
      return false;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setSearchResults(cached.results);
      setSearchError(null);
      setSearchLoading(false);
      return false;
    }

    setSearchLoading(true);
    setSearchError(null);

    void searchSpotifyCatalog(auth, trimmedQuery)
      .then((results) => {
        searchCacheRef.current.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          results,
        });
        setSearchResults(results);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Failed to search Spotify.";
        const rateLimitSeconds = parseSpotifyRateLimitSeconds(message);
        if (rateLimitSeconds) {
          rateLimitUntilRef.current = Date.now() + rateLimitSeconds * 1000;
          persistRateLimitUntil(rateLimitUntilRef.current);
        }
        setSearchResults(null);
        setSearchError(message);
      })
      .finally(() => {
        setSearchLoading(false);
      });
    return true;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!isMotionEnabled()) {
      return;
    }

    const rootNode = widgetRootRef.current;
    if (!rootNode) {
      return;
    }

    let cancelled = false;
    let activeAnimations: Array<{ cancel?: () => void }> = [];

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }

      const targets = authSession
        ? [
            rootNode.querySelector(`.${styles.spotifyHeader}`),
            rootNode.querySelector(`.${styles.playerPane}`),
            rootNode.querySelector(`.${styles.spotifySidebar}`),
          ]
        : [rootNode.querySelector(`.${styles.connectCard}`)];

      activeAnimations = targets
        .filter((target): target is Element => target instanceof Element)
        .map((target, index) =>
          anime.animate(target, {
            opacity: [0, 1],
            translateY: [12, 0],
            duration: MOTION_DURATIONS.short + 50,
            delay: index * MOTION_STAGGERS.normal,
          }),
        );
    });

    return () => {
      cancelled = true;
      activeAnimations.forEach((animation) => animation.cancel?.());
    };
  }, [authSession]);

  useEffect(() => {
    if (!authSession || !isMotionEnabled()) {
      return;
    }

    const sidebarNode = sidebarRef.current;
    if (!sidebarNode) {
      return;
    }

    const panelNode = sidebarNode.querySelector(
      `[data-spotify-tab-panel="${activeTab}"]`,
    );
    if (!(panelNode instanceof Element)) {
      return;
    }

    let cancelled = false;
    let animation: { cancel?: () => void } | null = null;

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }
      animation = anime.animate(panelNode, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: MOTION_DURATIONS.short,
      });
    });

    return () => {
      cancelled = true;
      animation?.cancel?.();
    };
  }, [authSession, activeTab]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const tabRowNode = tabRowRef.current;
    const tabIndicatorNode = tabIndicatorRef.current;
    if (!tabRowNode || !tabIndicatorNode) {
      return;
    }

    const placeIndicator = () => {
      const activeTabButton = tabRowNode.querySelector<HTMLButtonElement>(
        'button[role="tab"][aria-selected="true"]',
      );
      if (!activeTabButton) {
        return;
      }
      tabIndicatorNode.style.width = `${activeTabButton.offsetWidth}px`;
      tabIndicatorNode.style.transform = `translateX(${activeTabButton.offsetLeft}px)`;
      tabIndicatorNode.style.opacity = "1";
    };

    placeIndicator();

    const resizeObserver = new ResizeObserver(() => {
      placeIndicator();
    });
    resizeObserver.observe(tabRowNode);
    window.addEventListener("resize", placeIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", placeIndicator);
    };
  }, [authSession]);

  useEffect(() => {
    if (!authSession || !isMotionEnabled()) {
      return;
    }

    const tabRowNode = tabRowRef.current;
    const tabIndicatorNode = tabIndicatorRef.current;
    if (!tabRowNode || !tabIndicatorNode) {
      return;
    }

    const activeTabButton = tabRowNode.querySelector<HTMLButtonElement>(
      'button[role="tab"][aria-selected="true"]',
    );
    if (!activeTabButton) {
      return;
    }

    let cancelled = false;
    let animation: { cancel?: () => void } | null = null;

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }
      animation = anime.animate(tabIndicatorNode, {
        width: activeTabButton.offsetWidth,
        translateX: activeTabButton.offsetLeft,
        duration: MOTION_DURATIONS.short,
      });
    });

    return () => {
      cancelled = true;
      animation?.cancel?.();
    };
  }, [authSession, activeTab]);

  useEffect(() => {
    if (!authSession || !isMotionEnabled()) {
      return;
    }

    const sidebarNode = sidebarRef.current;
    if (!sidebarNode) {
      return;
    }

    const panelNode = sidebarNode.querySelector(
      `[data-spotify-tab-panel="${activeTab}"]`,
    );
    if (!(panelNode instanceof Element)) {
      return;
    }

    const rowNodes = Array.from(
      panelNode.querySelectorAll(`.${styles.resultButton}`),
    );
    if (!rowNodes.length) {
      return;
    }

    let cancelled = false;
    let activeAnimations: Array<{ cancel?: () => void }> = [];

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }

      if (anime.stagger) {
        const staggered = anime.animate(rowNodes, {
          opacity: [0, 1],
          translateX: [10, 0],
          duration: MOTION_DURATIONS.medium,
          delay: anime.stagger(MOTION_STAGGERS.tight),
        });
        activeAnimations = [staggered];
        return;
      }

      activeAnimations = rowNodes.map((rowNode, index) =>
        anime.animate(rowNode, {
          opacity: [0, 1],
          translateX: [10, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      );
    });

    return () => {
      cancelled = true;
      activeAnimations.forEach((animation) => animation.cancel?.());
    };
  }, [authSession, activeTab, listAnimationSignature]);

  useEffect(() => {
    if (!authSession || !isMotionEnabled()) {
      return;
    }

    if (primarySelectionUrl === lastPlayerSelectionUrlRef.current) {
      return;
    }
    lastPlayerSelectionUrlRef.current = primarySelectionUrl;

    const paneNode = playerPaneRef.current;
    if (!paneNode) {
      return;
    }

    let cancelled = false;
    let animation: { cancel?: () => void } | null = null;

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }
      animation = anime.animate(paneNode, {
        scale: [0.99, 1],
        opacity: [0.94, 1],
        duration: MOTION_DURATIONS.short + 30,
      });
    });

    return () => {
      cancelled = true;
      animation?.cancel?.();
    };
  }, [authSession, primarySelectionUrl]);

  useEffect(() => {
    if (!authSession || !activeSelection || !isMotionEnabled()) {
      return;
    }

    const cardNode = nowPlayingCardRef.current;
    const artworkNode = nowPlayingArtworkRef.current;
    const copyNode = nowPlayingCopyRef.current;
    if (!cardNode || !artworkNode || !copyNode) {
      return;
    }

    let cancelled = false;
    let activeAnimations: Array<{ cancel?: () => void }> = [];

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return;
      }
      activeAnimations = [
        anime.animate(cardNode, {
          opacity: [0.72, 1],
          scale: [0.992, 1],
          duration: NOW_PLAYING_ANIMATION_DURATION_MS,
        }),
        anime.animate(artworkNode, {
          opacity: [0.6, 1],
          scale: [0.94, 1],
          duration: NOW_PLAYING_ANIMATION_DURATION_MS + 30,
        }),
        anime.animate(copyNode, {
          opacity: [0, 1],
          translateY: [6, 0],
          duration: NOW_PLAYING_ANIMATION_DURATION_MS + 20,
        }),
      ];
    });

    return () => {
      cancelled = true;
      activeAnimations.forEach((animation) => animation.cancel?.());
    };
  }, [authSession, activeSelection]);

  useEffect(() => {
    if (!isMotionEnabled()) {
      return;
    }

    const rootNode = widgetRootRef.current;
    if (!rootNode) {
      return;
    }

    const isInteractiveButton = (button: HTMLButtonElement) =>
      button.classList.contains(styles.connectButton) ||
      button.classList.contains(styles.disconnectButton) ||
      button.classList.contains(styles.tabButton) ||
      button.classList.contains(styles.resultButton) ||
      button.classList.contains(styles.button);

    let cancelled = false;

    const animateButton = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return;
        }
        anime.animate(button, options);
      });
    };

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      const button = getInteractiveButton(event.target);
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return;
      }
      animateButton(button, {
        scale: 1.015,
        translateY: -1,
        duration: MOTION_DURATIONS.quick,
      });
    };

    const handlePointerLeave = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target);
      if (!button || !isInteractiveButton(button)) {
        return;
      }
      animateButton(button, {
        scale: 1,
        translateY: 0,
        duration: MOTION_DURATIONS.quick,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target);
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return;
      }
      animateButton(button, {
        scale: 0.98,
        translateY: 0,
        duration: Math.max(80, MOTION_DURATIONS.quick - 50),
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const button = getInteractiveButton(event.target);
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return;
      }
      animateButton(button, {
        scale: button.matches(":hover") ? 1.015 : 1,
        translateY: button.matches(":hover") ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      });
    };

    rootNode.addEventListener("pointerenter", handlePointerEnter, true);
    rootNode.addEventListener("pointerleave", handlePointerLeave, true);
    rootNode.addEventListener("pointerdown", handlePointerDown, true);
    rootNode.addEventListener("pointerup", handlePointerUp, true);
    rootNode.addEventListener("pointercancel", handlePointerUp, true);

    return () => {
      cancelled = true;
      rootNode.removeEventListener("pointerenter", handlePointerEnter, true);
      rootNode.removeEventListener("pointerleave", handlePointerLeave, true);
      rootNode.removeEventListener("pointerdown", handlePointerDown, true);
      rootNode.removeEventListener("pointerup", handlePointerUp, true);
      rootNode.removeEventListener("pointercancel", handlePointerUp, true);
    };
  }, [authSession]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch(searchQuery);
  };

  const handleConnect = () => {
    setConnectError(null);
    void startSpotifyLogin().catch((error: unknown) => {
      setConnectError(
        error instanceof Error ? error.message : "Spotify login failed.",
      );
    });
  };

  const handleDisconnect = () => {
    clearStoredSpotifyAuth();
    setSnapshot(null);
    setSearchQuery("");
    setSearchResults(null);
    setPlayError(null);
    setEmbedSelection(null);
  };

  const handlePlay = (selection: SpotifySelection) => {
    setPlayError(null);
    setEmbedSelection(selection);
  };

  if (!authSession) {
    return (
      <div
        ref={widgetRootRef}
        className={[
          styles.widget,
          isFullscreen ? styles.widgetFullscreen : "",
        ].join(" ")}
      >
        <section className={styles.connectCard}>
          <button
            className={styles.connectButton}
            type="button"
            onClick={handleConnect}
          >
            <MediaBrandIcon
              brand="spotify"
              size={14}
              className={styles.connectIcon}
            />
            <span>Connect Spotify</span>
          </button>
          <p className={styles.connectHint}>
            Connect Spotify to show the player here.
          </p>
          {connectError && <div className={styles.error}>{connectError}</div>}
        </section>
      </div>
    );
  }

  const profileName =
    snapshot?.profile.display_name ?? snapshot?.profile.id ?? "Spotify";
  const library = snapshot?.library;
  const recentSelections = (snapshot?.recentlyPlayed ?? [])
    .map((item) => {
      const selection = formatRecent(item);
      return selection ? { playedAt: item.played_at, selection } : null;
    })
    .filter(
      (item): item is { playedAt: string; selection: SpotifySelection } =>
        item !== null,
    );
  const results = searchResults ?? EMPTY_SEARCH_RESULTS;
  const hasSearchResults =
    results.tracks.length > 0 ||
    results.albums.length > 0 ||
    results.playlists.length > 0 ||
    results.shows.length > 0 ||
    results.episodes.length > 0;

  const tabs: Array<{
    id: SpotifyBrowseTab;
    label: string;
    Icon: typeof Search;
  }> = [
    { id: "search", label: "Search", Icon: Search },
    { id: "recent", label: "Recent", Icon: History },
    { id: "library", label: "Library", Icon: Library },
  ];

  return (
    <div
      ref={widgetRootRef}
      className={[
        styles.widget,
        isFullscreen ? styles.widgetFullscreen : "",
      ].join(" ")}
    >
      <section className={styles.spotifyShell}>
        <header className={styles.spotifyHeader}>
          <div className={styles.spotifyIdentity}>
            <div className={styles.spotifyAvatar}>
              <MediaBrandIcon
                brand="spotify"
                size={18}
                className={styles.spotifyLogo}
              />
            </div>
            <div className={styles.spotifyIdentityCopy}>
              <div className={styles.spotifyTitle}>Spotify</div>
              <div className={styles.spotifySubtitle}>{profileName}</div>
            </div>
          </div>
          <div className={styles.spotifyPills}>
            {accountProduct ? (
              <span className={styles.spotifyPill}>
                {accountProduct === "premium"
                  ? "Premium"
                  : `${accountProduct} plan`}
              </span>
            ) : null}
            <span className={styles.spotifyPill}>Embedded player</span>
            <button
              type="button"
              className={styles.disconnectButton}
              onClick={handleDisconnect}
              aria-label="Disconnect Spotify"
            >
              <LogOut size={12} />
              Disconnect
            </button>
          </div>
        </header>

        <div className={styles.spotifyLayout}>
          <div ref={playerPaneRef} className={styles.playerPane}>
            {activeSelection ? (
              <div ref={nowPlayingCardRef} className={styles.nowPlayingCard}>
                <div ref={nowPlayingArtworkRef} className={styles.nowPlayingArtwork}>
                  {activeSelection.artworkUrl ? (
                    <img
                      src={activeSelection.artworkUrl}
                      alt=""
                      className={styles.nowPlayingArtworkImage}
                    />
                  ) : (
                    <MediaBrandIcon brand="spotify" size={16} />
                  )}
                </div>
                <div ref={nowPlayingCopyRef} className={styles.nowPlayingCopy}>
                  <div className={styles.nowPlayingLabel}>Now playing</div>
                  <div className={styles.nowPlayingTitle}>{activeSelection.title}</div>
                  <div className={styles.nowPlayingSubtitle}>
                    {activeSelection.subtitle}
                  </div>
                </div>
              </div>
            ) : null}
            <SpotifyEmbedPlayer
              selection={activeSelection}
              colorScheme={resolveColorScheme(settings.colorScheme)}
              embedSize={
                isFullscreen
                  ? "fullscreen"
                  : isLargeEmbed
                    ? "large"
                    : "normal"
              }
            />
            {playError ? <div className={styles.error}>{playError}</div> : null}
            {snapshotError ? (
              <div className={styles.error}>{snapshotError}</div>
            ) : null}
            {connectError ? (
              <div className={styles.error}>{connectError}</div>
            ) : null}
          </div>

          <aside ref={sidebarRef} className={styles.spotifySidebar}>
            <div
              ref={tabRowRef}
              className={styles.tabRow}
              role="tablist"
              aria-label="Browse Spotify"
            >
              <span
                ref={tabIndicatorRef}
                aria-hidden="true"
                className={styles.tabIndicator}
              />
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  className={[
                    styles.tabButton,
                    activeTab === id ? styles.tabButtonActive : "",
                  ].join(" ")}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "search" ? (
              <form
                className={styles.searchPanel}
                data-spotify-tab-panel="search"
                onSubmit={handleSearchSubmit}
              >
                <div className={styles.searchRow}>
                  <input
                    className={styles.input}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Songs, albums, podcasts…"
                    aria-label="Search Spotify"
                  />
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={searchLoading}
                  >
                    {searchLoading ? "Searching…" : "Search"}
                  </button>
                </div>
                {searchError ? (
                  <div className={styles.error}>{searchError}</div>
                ) : null}
                {hasSearchResults ? (
                  <div className={styles.libraryCollections}>
                    <ResultGroup
                      title="Songs"
                      selections={results.tracks.map(formatSearchTrack)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Albums"
                      selections={results.albums.map(formatSearchAlbum)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Playlists"
                      selections={results.playlists.map(formatSearchPlaylist)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Podcasts"
                      selections={results.shows.map(formatSearchShow)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Episodes"
                      selections={results.episodes.map(formatSearchEpisode)}
                      onPlay={handlePlay}
                    />
                  </div>
                ) : (
                  <div className={styles.connectHint}>
                    {searchQuery.trim().length >= SEARCH_MIN_QUERY_LENGTH &&
                    !searchLoading
                      ? "No results found."
                      : "Search songs, albums, playlists, and podcasts, then tap to play."}
                  </div>
                )}
              </form>
            ) : null}

            {activeTab === "recent" ? (
              <div className={styles.librarySection} data-spotify-tab-panel="recent">
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Recently played</span>
                  {recentSelections.length ? (
                    <span className={styles.spotifyPill}>
                      {recentSelections.length}
                    </span>
                  ) : null}
                </div>
                {recentSelections.length ? (
                  <div
                    className={[styles.resultList, styles.scrollList].join(" ")}
                  >
                    {recentSelections.map((item) => (
                      <ResultRow
                        key={`${item.playedAt}-${item.selection.url}`}
                        selection={item.selection}
                        meta={formatRelativeTime(item.playedAt)}
                        onPlay={handlePlay}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.connectHint}>
                    {snapshotLoading
                      ? "Loading your history…"
                      : "Nothing played recently."}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "library" ? (
              <div className={styles.librarySection} data-spotify-tab-panel="library">
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    Your Spotify library
                  </span>
                </div>
                {library ? (
                  <div className={styles.libraryCollections}>
                    <ResultGroup
                      title="Playlists"
                      selections={library.playlists.map(formatSearchPlaylist)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Saved albums"
                      selections={library.savedAlbums.map(formatSavedAlbum)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Podcasts"
                      selections={library.savedShows.map(formatSavedShow)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Top tracks"
                      selections={library.topTracks.map(formatTopTrack)}
                      onPlay={handlePlay}
                    />
                    <ResultGroup
                      title="Top artists"
                      selections={library.topArtists.map(formatTopArtist)}
                      onPlay={handlePlay}
                    />
                  </div>
                ) : (
                  <div className={styles.connectHint}>
                    {snapshotLoading
                      ? "Loading your library…"
                      : "Your library is not available yet."}
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
