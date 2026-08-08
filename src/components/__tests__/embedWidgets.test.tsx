import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { SpotifyWidget } from '../SpotifyWidget'
import { AppleMusicWidget } from '../AppleMusicWidget'
import { SpotifyPodcastWidget } from '../SpotifyPodcastWidget'
import { ApplePodcastWidget } from '../ApplePodcastWidget'

function renderWithSettings(ui: ReactElement, settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(<SettingsProvider>{ui}</SettingsProvider>)
}

describe('music widgets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('renders a Spotify iframe with full web app', () => {
    renderWithSettings(<SpotifyWidget />)
    expect(screen.getByTitle('Spotify')).toHaveAttribute(
      'src',
      'https://open.spotify.com',
    )
  })

  it('renders an Apple Music iframe with full web app', () => {
    renderWithSettings(<AppleMusicWidget />)
    expect(screen.getByTitle('Apple Music')).toHaveAttribute(
      'src',
      'https://music.apple.com',
    )
  })

  it('renders a Spotify Podcast iframe with full web app', () => {
    renderWithSettings(<SpotifyPodcastWidget />)
    expect(screen.getByTitle('Spotify')).toHaveAttribute(
      'src',
      'https://open.spotify.com',
    )
  })

  it('renders an Apple Podcasts iframe with full web app', () => {
    renderWithSettings(<ApplePodcastWidget />)
    expect(screen.getByTitle('Apple Podcasts')).toHaveAttribute(
      'src',
      'https://podcasts.apple.com',
    )
  })
})
