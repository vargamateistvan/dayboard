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

vi.mock('../../lib/spotifyAuth', () => ({
  getStoredSpotifyAuth: vi.fn(() => null),
  onSpotifyAuthChanged: vi.fn(() => () => {}),
}))

vi.mock('../../lib/spotifyApi', () => ({
  fetchSpotifyAccountSnapshot: vi.fn(),
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

  it('shows connected Spotify playback details when an account is linked', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60_000,
    })
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockResolvedValue({
      profile: {
        id: 'dayboard',
        display_name: 'Dayboard',
        images: [],
      },
      playback: {
        device: {
          id: 'device',
          is_active: true,
          is_private_session: false,
          is_restricted: false,
          name: 'Browser',
          type: 'computer',
          volume_percent: 75,
        },
        is_playing: true,
        progress_ms: 90_000,
        item: {
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
          duration_ms: 257_000,
        },
      },
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
        topArtists: [
          {
            name: 'Fleetwood Mac',
            images: [],
            external_urls: {
              spotify: 'https://open.spotify.com/artist/example',
            },
          },
        ],
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
        playlists: [],
      },
    })

    renderWithSettings(<SpotifyWidget />)

    expect(await screen.findByTitle('Spotify Player player')).toHaveAttribute(
      'src',
      expect.stringContaining('https://open.spotify.com/embed/track/example'),
    )
    expect(screen.getByText('Your Spotify library')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Tracks, albums, or playlists/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect Spotify/i })).not.toBeInTheDocument()
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
