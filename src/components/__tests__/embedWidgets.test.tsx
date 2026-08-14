import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { MusicEmbedWidget } from '../MusicEmbedWidget'
import { PodcastEmbedWidget } from '../PodcastEmbedWidget'
import { SpotifyWidget } from '../SpotifyWidget'
import { AppleMusicWidget } from '../AppleMusicWidget'
import { ApplePodcastWidget } from '../ApplePodcastWidget'
import * as spotifyAuth from '../../lib/spotifyAuth'
import * as spotifyApi from '../../lib/spotifyApi'

const playbackControls = vi.hoisted(() => ({
  activate: vi.fn(async () => {}),
  togglePlay: vi.fn(async () => {}),
  next: vi.fn(async () => {}),
  previous: vi.fn(async () => {}),
  seek: vi.fn(async () => {}),
  setVolume: vi.fn(async () => {}),
}))

vi.mock('../../lib/spotifyAuth', () => ({
  getStoredSpotifyAuth: vi.fn(() => null),
  onSpotifyAuthChanged: vi.fn(() => () => {}),
  clearStoredSpotifyAuth: vi.fn(),
  startSpotifyLogin: vi.fn(async () => {}),
}))

vi.mock('../../lib/spotifyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/spotifyApi')>()),
  fetchSpotifyAccountSnapshot: vi.fn(),
  searchSpotifyCatalog: vi.fn(),
}))

vi.mock('../../lib/spotifyWebPlayback', () => ({
  useSpotifyWebPlayback: vi.fn(() => [
    {
      status: 'ready',
      deviceId: 'device-1',
      isActive: false,
      isPaused: true,
      nowPlaying: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.5,
      error: null,
    },
    playbackControls,
  ]),
}))

function renderWithSettings(ui: ReactElement, settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(<SettingsProvider>{ui}</SettingsProvider>)
}

describe('MusicEmbedWidget', () => {
  it.each([
    [
      'spotify',
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?theme=0',
    ],
    [
      'apple-music',
      'https://music.apple.com/us/album/1989/1440935467?i=1440935475',
      'https://embed.music.apple.com/us/album/1989/1440935467?i=1440935475&theme=dark',
    ],
  ] as const)('renders a %s player for a valid share url', (provider, shareUrl, expectedSrc) => {
    render(
      <MusicEmbedWidget title="Player" provider={provider} shareUrl={shareUrl} />,
    )

    expect(screen.getByTitle('Player player')).toHaveAttribute(
      'src',
      expect.stringContaining(expectedSrc),
    )
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open full player' })).toBeInTheDocument()
  })

  it('shows an error when the share url is invalid', () => {
    render(<MusicEmbedWidget title="Player" provider="spotify" shareUrl="https://example.com" />)

    expect(screen.getByText(/not a valid Spotify URL/i)).toBeInTheDocument()
  })
})

describe('PodcastEmbedWidget', () => {
  it.each([
    [
      'spotify',
      'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk',
      'https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk?theme=0',
    ],
    [
      'apple-podcast',
      'https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272',
      'https://embed.podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272?theme=dark',
    ],
  ] as const)('renders a %s player for a valid share url', (provider, shareUrl, expectedSrc) => {
    render(
      <PodcastEmbedWidget title="Podcast Player" provider={provider} shareUrl={shareUrl} />,
    )

    expect(screen.getByTitle('Podcast Player player')).toHaveAttribute(
      'src',
      expect.stringContaining(expectedSrc),
    )
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open full player' })).toBeInTheDocument()
  })

  it('shows an error when the share url is invalid', () => {
    render(
      <PodcastEmbedWidget title="Podcast Player" provider="spotify" shareUrl="https://example.com" />,
    )

    expect(screen.getByText(/not a valid Spotify URL/i)).toBeInTheDocument()
  })
})

describe('SpotifyWidget', () => {
  const authSession = {
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 60_000,
  }

  const baseSnapshot = {
    profile: {
      id: 'dayboard',
      display_name: 'Dayboard',
      images: [],
    },
    playback: null,
    recentlyPlayed: null,
    library: null,
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows a connect button when Spotify is not linked', () => {
    renderWithSettings(<SpotifyWidget />)

    expect(screen.getByRole('button', { name: /Connect Spotify/i })).toBeInTheDocument()
    expect(screen.getByText(/Connect Spotify to show the player here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Spotify/i }).querySelector('img')).toBeTruthy()
  })

  it('shows the browser player and library when an account is linked', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(authSession)
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockResolvedValue({
      ...baseSnapshot,
      recentlyPlayed: [
        {
          played_at: '2026-08-13T10:00:00.000Z',
          track: {
            type: 'track',
            name: 'Dreams',
            artists: [{ name: 'Fleetwood Mac' }],
            album: {
              name: 'Rumours',
              images: [],
            },
            external_urls: {
              spotify: 'https://open.spotify.com/track/example',
            },
          },
        },
      ],
      library: {
        topArtists: [],
        topTracks: [
          {
            name: 'Dreams',
            artists: [{ name: 'Fleetwood Mac' }],
            album: {
              name: 'Rumours',
              images: [],
            },
            external_urls: {
              spotify: 'https://open.spotify.com/track/example',
            },
          },
        ],
        savedAlbums: [],
        savedShows: [
          {
            show: {
              name: 'Dreams Podcast',
              publisher: 'Dreamer FM',
              images: [],
              external_urls: {
                spotify: 'https://open.spotify.com/show/example',
              },
            },
          },
        ],
        playlists: [],
      },
    })

    renderWithSettings(<SpotifyWidget />)

    expect(await screen.findByText('Dayboard')).toBeInTheDocument()
    expect(screen.getByText(/Ready to stream in this browser/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Connect Spotify$/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Library/i }))
    expect(await screen.findByText('Your Spotify library')).toBeInTheDocument()
    expect(screen.getByText('Dreams')).toBeInTheDocument()
    expect(screen.getByText('Dreams Podcast')).toBeInTheDocument()
  })

  it('plays a search result through the browser player', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(authSession)
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockResolvedValue(baseSnapshot)
    vi.mocked(spotifyApi.searchSpotifyCatalog).mockResolvedValue({
      tracks: [
        {
          type: 'track',
          name: 'Dreams',
          artists: [{ name: 'Fleetwood Mac' }],
          album: {
            name: 'Rumours',
            images: [],
          },
          external_urls: {
            spotify: 'https://open.spotify.com/track/example',
          },
        },
      ],
      albums: [],
      playlists: [],
      shows: [],
      episodes: [],
    })

    renderWithSettings(<SpotifyWidget />)

    const searchInput = await screen.findByPlaceholderText(/Songs, albums, podcasts/i)
    fireEvent.change(searchInput, { target: { value: 'dreams' } })

    fireEvent.click(await screen.findByText('Dreams'))

    await waitFor(() => {
      expect(playbackControls.activate).toHaveBeenCalledWith({
        uris: ['spotify:track:example'],
      })
    })
  })

  it('falls back to the embedded player for free accounts', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(authSession)
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockResolvedValue({
      ...baseSnapshot,
      profile: {
        ...baseSnapshot.profile,
        product: 'free',
      },
    })
    vi.mocked(spotifyApi.searchSpotifyCatalog).mockResolvedValue({
      tracks: [
        {
          type: 'track',
          name: 'Dreams',
          artists: [{ name: 'Fleetwood Mac' }],
          album: {
            name: 'Rumours',
            images: [],
          },
          external_urls: {
            spotify: 'https://open.spotify.com/track/example',
          },
        },
      ],
      albums: [],
      playlists: [],
      shows: [],
      episodes: [],
    })

    renderWithSettings(<SpotifyWidget />)

    expect(await screen.findByText(/playing through Spotify's embedded player/i)).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/Songs, albums, podcasts/i)
    fireEvent.change(searchInput, { target: { value: 'dreams' } })
    fireEvent.click(await screen.findByText('Dreams'))

    expect(await screen.findByTitle('Spotify player: Dreams')).toHaveAttribute(
      'src',
      expect.stringContaining('https://open.spotify.com/embed/track/example'),
    )
    expect(playbackControls.activate).not.toHaveBeenCalled()
  })

  it('ignores recently played entries missing track details', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(authSession)
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockResolvedValue({
      ...baseSnapshot,
      recentlyPlayed: [
        {
          played_at: '2026-08-13T10:00:00.000Z',
          track: null,
        },
      ],
    })

    renderWithSettings(<SpotifyWidget />)

    expect(await screen.findByText('Dayboard')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Recent/i }))
    expect(await screen.findByText(/Nothing played recently/i)).toBeInTheDocument()
    expect(screen.queryByText(/TypeError/i)).not.toBeInTheDocument()
  })
})

describe('AppleMusicWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('updates the saved Apple Music link list when a new url is added', async () => {
    renderWithSettings(<AppleMusicWidget />)

    fireEvent.change(screen.getByPlaceholderText(/Paste another Apple Music song/i), {
      target: { value: 'https://music.apple.com/us/album/midnights/1625498918' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').appleMusicEmbedUrl,
      ).toBe('https://music.apple.com/us/album/midnights/1625498918')
      expect(screen.getByTitle('Apple Music Player player')).toHaveAttribute(
        'src',
        expect.stringContaining('https://embed.music.apple.com/us/album/midnights/1625498918'),
      )
    })
  })
})

describe('ApplePodcastWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('updates the saved Apple Podcast link list when a new url is added', async () => {
    renderWithSettings(<ApplePodcastWidget />)

    fireEvent.change(screen.getByPlaceholderText(/Paste another Apple Podcast show/i), {
      target: { value: 'https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').applePodcastEmbedUrl,
      ).toBe('https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110')
      expect(screen.getByTitle('Apple Podcast player')).toHaveAttribute(
        'src',
        expect.stringContaining('https://embed.podcasts.apple.com/us/podcast/huberman-lab/id1545953110'),
      )
    })
  })
})
