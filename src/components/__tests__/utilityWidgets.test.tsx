import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { BuyMeCoffeeWidget } from '../BuyMeCoffeeWidget'
import { MediaBrandIcon } from '../MediaBrandIcon'
import { NotesWidget } from '../NotesWidget'
import { NotificationBadge } from '../NotificationBadge'
import { StockWidget } from '../StockWidget'
import { CurrencyWidget } from '../CurrencyWidget'
import { DeviceInfoWidget } from '../DeviceInfoWidget'
import { SportsScoresWidget } from '../SportsScoresWidget'

function renderWithSettings(ui: ReactElement, settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch })
  return render(<SettingsProvider>{ui}</SettingsProvider>)
}

describe('NotificationBadge', () => {
  it('renders nothing when there are no notifications', () => {
    const { container } = render(<NotificationBadge notifications={[]} onDismiss={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('dismisses the selected notification', () => {
    const onDismiss = vi.fn()

    render(
      <NotificationBadge
        notifications={[
          {
            id: 'event-1',
            type: 'event',
            title: 'Team standup',
            body: 'Starting in 10 minutes',
            timestamp: 123,
          },
        ]}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    expect(onDismiss).toHaveBeenCalledWith('event-1')
  })
})

describe('MediaBrandIcon', () => {
  it.each([
    ['spotify', 'media-logos/spotify.png'],
    ['apple-music', 'media-logos/apple-music.png'],
    ['apple-podcasts', 'media-logos/apple-podcasts.png'],
  ] as const)('uses the expected asset for %s', (brand, expectedPath) => {
    const { container } = render(<MediaBrandIcon brand={brand} size={18} className="brand-icon" />)
    const image = container.querySelector('img')

    expect(image).toHaveAttribute('src', expect.stringContaining(expectedPath))
    expect(image).toHaveAttribute('width', '18')
    expect(image).toHaveAttribute('height', '18')
  })
})

describe('NotesWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('creates, recolors, and deletes a note', () => {
    render(<NotesWidget />)

    fireEvent.click(screen.getByTitle('Add note'))

    const note = screen.getByPlaceholderText('Type your note...')
    fireEvent.change(note, { target: { value: 'Capture release notes' } })
    fireEvent.click(screen.getByTitle('Change to blue'))

    const storedNotes = JSON.parse(localStorage.getItem('dayboard_notes') ?? '[]')
    expect(storedNotes).toHaveLength(1)
    expect(storedNotes[0]).toMatchObject({ text: 'Capture release notes', color: 'blue' })

    fireEvent.click(screen.getByTitle('Delete note'))

    expect(screen.getByText('Click + to add your first note')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('dayboard_notes') ?? '[]')).toHaveLength(0)
  })
})

describe('BuyMeCoffeeWidget', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.setProperty('--color-accent', '#123456')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--color-accent')
    vi.restoreAllMocks()
  })

  it('opens the support panel with the configured accent color', () => {
    renderWithSettings(<BuyMeCoffeeWidget />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Buy Me a Coffee widget' }))

    const frame = screen.getByTitle('Buy Me a Coffee')
    expect(frame).toHaveAttribute('src', expect.stringContaining('color=%23123456'))
    expect(frame).toHaveAttribute(
      'src',
      expect.stringContaining('description=Support+me+on+Buy+me+a+coffee%21'),
    )

    fireEvent.click(
      within(screen.getByLabelText('Buy Me a Coffee support panel')).getByRole('button', {
        name: 'Close Buy Me a Coffee widget',
      }),
    )

    expect(screen.queryByLabelText('Buy Me a Coffee support panel')).not.toBeInTheDocument()
  })

  it('hides itself when disabled in settings', () => {
    renderWithSettings(<BuyMeCoffeeWidget />, { showBuyMeACoffeeWidget: false })

    expect(screen.queryByRole('button', { name: /Buy Me a Coffee widget/ })).not.toBeInTheDocument()
  })
})

describe('StockWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the selected stock quote', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          chart: {
            result: [{
              meta: {
                symbol: 'AAPL',
                longName: 'Apple Inc.',
                exchangeName: 'NMS',
                currency: 'USD',
                regularMarketPrice: 313.33,
                chartPreviousClose: 312.41,
                marketState: 'CLOSED',
              },
              indicators: {
                quote: [{ close: [310.0, 311.5, 312.41, 313.33] }],
              },
            }],
            error: null,
          },
        }),
      }),
    )

    renderWithSettings(<StockWidget />, { stockSymbols: ['AAPL'] })

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(/\$313\.33/)).toBeInTheDocument()
    // change = 313.33 - 312.41 = 0.92
    expect(screen.getByText(/\+0\.92/)).toBeInTheDocument()
    expect(screen.getByText(/○ Closed/)).toBeInTheDocument()
  })
})

describe('CurrencyWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the selected currency rate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: 'success',
          base: 'USD',
          time_last_update_utc: 'Sun, 09 Aug 2026 00:02:31 +0000',
          rates: { EUR: 0.92 },
        }),
      }),
    )

    renderWithSettings(<CurrencyWidget />, {
      currencyPairs: [['USD', 'EUR']],
    })

    expect(await screen.findByText(/1 USD = 0.92 EUR/)).toBeInTheDocument()
    expect(screen.getByText(/1 EUR = 1\.086957 USD/)).toBeInTheDocument()
  })
})

describe('DeviceInfoWidget', () => {
  it('renders key platform fields', () => {
    render(<DeviceInfoWidget />)

    expect(screen.getByText('Device Info')).toBeInTheDocument()
    expect(screen.getByText('Operating system')).toBeInTheDocument()
    expect(screen.getByText('Device type')).toBeInTheDocument()
    expect(screen.getByText('Browser')).toBeInTheDocument()
    expect(screen.getByText('Timezone')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getAllByText('Battery').length).toBeGreaterThan(0)
    expect(screen.getByText('CPU usage')).toBeInTheDocument()
    expect(screen.getAllByText('Memory').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Disk').length).toBeGreaterThan(0)
    expect(screen.getByText('Net throughput')).toBeInTheDocument()
  })
})

describe('SportsScoresWidget', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows an empty state when no favorite teams are configured', () => {
    renderWithSettings(<SportsScoresWidget />, { sportsFavoriteTeams: [] })

    expect(
      screen.getByText(/Pick favorite teams or followed leagues in Settings to see live score feeds/i),
    ).toBeInTheDocument()
  })

  it('renders the latest result for each favorite team', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                idHomeTeam: '133604',
                idAwayTeam: '133602',
                strHomeTeam: 'Arsenal',
                strAwayTeam: 'Chelsea',
                intHomeScore: '2',
                intAwayScore: '1',
                strStatus: 'Match Finished',
                strTimestamp: '2026-08-10T16:30:00+00:00',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: [
              {
                idTeam: '133604',
                strBadge: 'https://images.example.com/arsenal.png',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            teams: [
              {
                idTeam: '133602',
                strBadge: 'https://images.example.com/chelsea.png',
              },
            ],
          }),
        }),
    )

    renderWithSettings(<SportsScoresWidget />, {
      sportsFavoriteTeams: [
        {
          id: '133604',
          name: 'Arsenal',
          leagueId: 'EPL',
          leagueName: 'Premier League',
          sport: 'soccer',
        },
      ],
      sportsFollowedLeagues: [],
      sportsRefreshMinutes: 15,
    })

    expect(await screen.findByText('Arsenal')).toBeInTheDocument()
    expect(screen.getByText('Chelsea')).toBeInTheDocument()
    expect(screen.getByText('2 - 1')).toBeInTheDocument()
    expect(screen.getByText('Win')).toBeInTheDocument()
    expect(screen.getByText('FT')).toBeInTheDocument()
    expect(screen.getByText(/Updated just now/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Arsenal logo' })).toHaveAttribute(
      'src',
      'https://images.example.com/arsenal.png',
    )
    expect(screen.getByRole('img', { name: 'Chelsea logo' })).toHaveAttribute(
      'src',
      'https://images.example.com/chelsea.png',
    )
  })

  it('renders followed league scores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              idEvent: 'epl-1',
              strHomeTeam: 'Arsenal',
              strAwayTeam: 'Chelsea',
              intHomeScore: '2',
              intAwayScore: '1',
              strStatus: 'Match Finished',
              strTimestamp: '2026-08-10T16:30:00+00:00',
            },
          ],
        }),
      }),
    )

    renderWithSettings(<SportsScoresWidget />, {
      sportsFavoriteTeams: [],
      sportsFollowedLeagues: ['EPL'],
      sportsRefreshMinutes: 15,
    })

    expect(await screen.findByText('League scores')).toBeInTheDocument()
    expect(screen.getByText('Arsenal')).toBeInTheDocument()
    expect(screen.getByText('Chelsea')).toBeInTheDocument()
    expect(screen.getByText('2 - 1')).toBeInTheDocument()
    expect(screen.getByText('Premier League')).toBeInTheDocument()
  })
})
