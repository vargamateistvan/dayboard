import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { SpotifyWidget } from '../SpotifyWidget'
import { AppleMusicWidget } from '../AppleMusicWidget'
import * as spotifyAuth from '../../lib/spotifyAuth'
import * as spotifyApi from '../../lib/spotifyApi'
import * as appleSearchApi from '../../lib/appleSearchApi'

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

vi.mock('../../lib/appleSearchApi', () => ({
  searchAppleMusicCatalog: vi.fn(),
  searchApplePodcastCatalog: vi.fn(),
}))

function renderWithSettings(ui: ReactElement) {
  saveSettings({ ...DEFAULT_SETTINGS })
  return render(<SettingsProvider>{ui}</SettingsProvider>)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const AUTH = { accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 }
const SNAPSHOT = {
  profile: { id: 'dayboard', display_name: 'Dayboard', images: [] },
  recentlyPlayed: null,
  library: null,
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('Spotify account sync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('keeps the account on screen when a later sync fails', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(AUTH)
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot)
      .mockResolvedValueOnce(SNAPSHOT)
      .mockRejectedValue(new Error('Failed to load Spotify data. Network error.'))

    renderWithSettings(<SpotifyWidget />)
    expect(await screen.findByText('Dayboard')).toBeInTheDocument()

    await advance(121_000)

    expect(spotifyApi.fetchSpotifyAccountSnapshot).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Dayboard')).toBeInTheDocument()
  })

  it('asks to reconnect when the Spotify session has expired', async () => {
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(AUTH)
    const expired = new Error('Spotify session expired. Please reconnect Spotify.')
    expired.name = 'SpotifySessionExpiredError'
    vi.mocked(spotifyApi.fetchSpotifyAccountSnapshot).mockRejectedValue(expired)

    renderWithSettings(<SpotifyWidget />)

    expect(await screen.findByText(/reconnect Spotify/i)).toBeInTheDocument()
    expect(screen.queryByText('Dayboard')).not.toBeInTheDocument()
  })
})

describe('Apple Music search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  function songResults(title: string) {
    return {
      songs: [{ url: `https://music.apple.com/us/album/x/1?i=${title}`, title, subtitle: 'Artist', artworkUrl: undefined }],
      albums: [],
      artists: [],
    }
  }

  it('ignores an older, slower search that finishes after a newer one', async () => {
    const older = deferred<ReturnType<typeof songResults>>()
    const newer = deferred<ReturnType<typeof songResults>>()
    vi.mocked(appleSearchApi.searchAppleMusicCatalog).mockImplementation((query: string) =>
      query === 'dr' ? older.promise : newer.promise,
    )

    renderWithSettings(<AppleMusicWidget />)
    const input = screen.getByPlaceholderText(/Songs, albums, artists/i)

    fireEvent.change(input, { target: { value: 'dr' } })
    await advance(500)
    fireEvent.change(input, { target: { value: 'dre' } })
    await advance(500)

    await act(async () => newer.resolve(songResults('Dreams')))
    await act(async () => older.resolve(songResults('Drive')))

    expect(screen.getByText('Dreams')).toBeInTheDocument()
    expect(screen.queryByText('Drive')).not.toBeInTheDocument()
  })

  it('does not show results that arrive after the box was cleared', async () => {
    const pending = deferred<ReturnType<typeof songResults>>()
    vi.mocked(appleSearchApi.searchAppleMusicCatalog).mockReturnValue(pending.promise)

    renderWithSettings(<AppleMusicWidget />)
    const input = screen.getByPlaceholderText(/Songs, albums, artists/i)

    fireEvent.change(input, { target: { value: 'dreams' } })
    await advance(500)
    fireEvent.change(input, { target: { value: '' } })
    await act(async () => pending.resolve(songResults('Dreams')))

    expect(screen.queryByText('Dreams')).not.toBeInTheDocument()
  })
})
