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

  it('renders a Spotify iframe', () => {
    renderWithSettings(<SpotifyWidget />)
    expect(screen.getByTitle('Spotify Player')).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT',
    )
  })

  it('renders an Apple Music iframe', () => {
    renderWithSettings(<AppleMusicWidget />)
    expect(screen.getByTitle('Apple Music Player')).toHaveAttribute(
      'src',
      'https://embed.music.apple.com/us/album/blinding-lights/1499378108?i=1499378110',
    )
  })

  it('renders a Spotify Podcast iframe', () => {
    renderWithSettings(<SpotifyPodcastWidget />)
    expect(screen.getByTitle('Spotify Podcast')).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk',
    )
  })

  it('renders an Apple Podcast iframe', () => {
    renderWithSettings(<ApplePodcastWidget />)
    expect(screen.getByTitle('Apple Podcast')).toHaveAttribute(
      'src',
      'https://embed.podcasts.apple.com/us/podcast/the-joe-rogan-experience/id360084272',
    )
  })
})
