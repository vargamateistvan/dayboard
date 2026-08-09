import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { MusicEmbedWidget } from '../MusicEmbedWidget'
import { PodcastEmbedWidget } from '../PodcastEmbedWidget'
import { SpotifyWidget } from '../SpotifyWidget'
import { AppleMusicWidget } from '../AppleMusicWidget'
import { ApplePodcastWidget } from '../ApplePodcastWidget'

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
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('updates the saved Spotify link list when a new url is added', () => {
    renderWithSettings(<SpotifyWidget />)

    fireEvent.change(screen.getByPlaceholderText(/Paste another Spotify track/i), {
      target: { value: 'https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').spotifyEmbedUrl,
    ).toBe('https://open.spotify.com/track/7ouMYWpwJ422jRcDASZB7P')
    expect(screen.getByTitle('Spotify Player player')).toHaveAttribute(
      'src',
      expect.stringContaining('https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P'),
    )
  })
})

describe('AppleMusicWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('updates the saved Apple Music link list when a new url is added', () => {
    renderWithSettings(<AppleMusicWidget />)

    fireEvent.change(screen.getByPlaceholderText(/Paste another Apple Music song/i), {
      target: { value: 'https://music.apple.com/us/album/midnights/1625498918' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').appleMusicEmbedUrl,
    ).toBe('https://music.apple.com/us/album/midnights/1625498918')
    expect(screen.getByTitle('Apple Music Player player')).toHaveAttribute(
      'src',
      expect.stringContaining('https://embed.music.apple.com/us/album/midnights/1625498918'),
    )
  })
})

describe('ApplePodcastWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('updates the saved Apple Podcast link list when a new url is added', () => {
    renderWithSettings(<ApplePodcastWidget />)

    fireEvent.change(screen.getByPlaceholderText(/Paste another Apple Podcast show/i), {
      target: { value: 'https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').applePodcastEmbedUrl,
    ).toBe('https://podcasts.apple.com/us/podcast/huberman-lab/id1545953110')
    expect(screen.getByTitle('Apple Podcast player')).toHaveAttribute(
      'src',
      expect.stringContaining('https://embed.podcasts.apple.com/us/podcast/huberman-lab/id1545953110'),
    )
  })
})
