import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SettingsDialog } from '../SettingsDialog'
import { SettingsProvider } from '../../lib/useSettings'
import { searchSportsTeams } from '../../lib/sports'
import * as spotifyAuth from '../../lib/spotifyAuth'

vi.mock('../../lib/sports', () => ({
  searchSportsTeams: vi.fn(),
}))

vi.mock('../../lib/spotifyAuth', () => ({
  getStoredSpotifyAuth: vi.fn(() => null),
  startSpotifyLogin: vi.fn(() => Promise.resolve()),
  clearStoredSpotifyAuth: vi.fn(),
  consumeSpotifyAuthNotice: vi.fn(() => null),
}))

const LAYOUT_STORAGE_KEY = 'dayboard_widget_layout'
const SETTINGS_STORAGE_KEY = 'dayboard:settings'
const PRESET_STORAGE_KEY = 'dayboard:settings-presets'

function renderSettingsDialog(selectedPresetName?: string) {
  return render(
    <SettingsProvider>
      <SettingsDialog onClose={() => {}} selectedPresetName={selectedPresetName} />
    </SettingsProvider>,
  )
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(spotifyAuth.getStoredSpotifyAuth).mockReturnValue(null)
    vi.mocked(spotifyAuth.consumeSpotifyAuthNotice).mockReturnValue(null)
    vi.mocked(spotifyAuth.startSpotifyLogin).mockImplementation(() => Promise.resolve())
  })

  it('renders only visible widgets in the 3x2 mini-grid', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: {
          clock: true,
          weather: false,
          calendar: true,
          timer: true,
          tasks: true,
          kanban: false,
        },
        placements: {
          clock:    { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          weather:  { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
          calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
          timer:    { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          tasks:    { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
          kanban:   { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
        },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))

    expect(screen.getByTestId('layout-widget-clock')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-widget-weather')).not.toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-timer')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-tasks')).toBeInTheDocument()
  })

  it('adds a hidden widget from the palette with one click', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Add Tasks to dashboard' }))

    expect(screen.getByTestId('layout-widget-tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tasks is on the dashboard' })).toBeInTheDocument()
  })

  it('removes a widget from the grid when the × button is clicked', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))

    // 4 widgets are visible by default (tasks is hidden)
    // 4 widgets are visible by default (tasks and kanban are hidden)
    expect(screen.getByTestId('layout-widget-weather')).toBeInTheDocument()

    // Click the × button to remove weather from the dashboard
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weather from dashboard' }))

    // Weather should no longer appear in the grid
    expect(screen.queryByTestId('layout-widget-weather')).not.toBeInTheDocument()

    // The palette should show weather as a hidden chip (with grip icon present)
    expect(screen.getByTitle('Add Weather to dashboard')).toBeInTheDocument()
  })

  it('persists the calendar extra info preview mode', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarExtraInfoPreview: 'weekly',
    })
  })

  it('persists the calendar week start setting', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Sunday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarWeekStartsOn: 'sunday',
    })
  })

  it('shows the past events toggle as pressed only when past events are visible', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    const toggle = screen.getByRole('button', { name: /Show past events/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('persists appearance, font, and support visibility settings', () => {
    renderSettingsDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('button', { name: 'Orbitron' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Buy Me a Coffee button' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      colorScheme: 'dark',
      fontPreset: 'orbitron',
      showBuyMeACoffeeWidget: false,
    })
  })

  it('persists weather display and refresh settings', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Show past events' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show all-day events' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show extra weather details' }))
    fireEvent.change(screen.getByLabelText('Refresh every (min)'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarHidePastEvents: true,
      calendarShowAllDayEvents: false,
      weatherShowExtraDetails: false,
      weatherRefreshMinutes: 15,
    })
  })

  it('persists manual clock font-size settings', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.change(screen.getByLabelText('Time font size (rem)'), { target: { value: '18.5' } })
    fireEvent.change(screen.getByLabelText('Date font size (rem)'), { target: { value: '2.1' } })
    fireEvent.change(screen.getByLabelText('Time stretch (%)'), { target: { value: '135' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      clockTimeFontSizeRem: 18.5,
      clockDateFontSizeRem: 2.1,
      clockTimeStretchPercent: 135,
    })
  })

  it('updates clock settings immediately while editing', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.change(screen.getByLabelText('Time stretch (%)'), { target: { value: '145' } })

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      clockTimeStretchPercent: 145,
    })
  })

  it('persists sports widget refresh and league filters', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: { sports: true },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.change(screen.getByLabelText('Refresh every (minutes)'), { target: { value: '20' } })
    const premierLeagueButtons = screen.getAllByRole('button', { name: 'Premier League' })
    fireEvent.click(premierLeagueButtons[0])
    fireEvent.click(premierLeagueButtons[1])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
    expect(saved).toMatchObject({
      sportsRefreshMinutes: 20,
    })
    expect(saved.sportsEnabledLeagues).not.toContain('EPL')
    expect(saved.sportsFollowedLeagues).toContain('EPL')
  })

  it('persists sports favorite team removals immediately without pressing save', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: { sports: true },
      }),
    )
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        sportsFavoriteTeams: [
          {
            id: '133604',
            name: 'Arsenal',
            leagueId: 'EPL',
            leagueName: 'Premier League',
            sport: 'soccer',
          },
        ],
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Arsenal' }))

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
    expect(saved.sportsFavoriteTeams).toEqual([])
  })

  it('persists sports favorite team additions immediately without pressing save', async () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: { sports: true },
      }),
    )

    vi.mocked(searchSportsTeams).mockResolvedValue([
      {
        id: '133604',
        name: 'Arsenal',
        leagueId: 'EPL',
        leagueName: 'Premier League',
        sport: 'soccer',
        badgeUrl: 'https://images.example.com/arsenal.png',
      },
    ])

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Arsenal, Real Madrid, Lakers'), {
      target: { value: 'ars' },
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, 650)
    })
    await waitFor(() => {
      expect(searchSportsTeams).toHaveBeenCalled()
    })
    const addButton = await screen.findByRole('button', { name: 'Add' })
    fireEvent.click(addButton)

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
    expect(saved.sportsFavoriteTeams).toEqual([
      expect.objectContaining({
        id: '133604',
        name: 'Arsenal',
        leagueId: 'EPL',
      }),
    ])
  })

  it('persists timezone clock city and timezone settings', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: { timezoneClock: true },
      }),
    )
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.change(screen.getByPlaceholderText('New York'), {
      target: { value: 'Budapest' },
    })
    fireEvent.change(screen.getByPlaceholderText('America/New_York'), {
      target: { value: 'Europe/Budapest' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      worldClockCity: 'Budapest',
      worldClockTimeZone: 'Europe/Budapest',
    })
  })

  it('shows widget-specific settings only when the widget is on the layout', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: {
          clock: true,
          weather: false,
          calendar: false,
          timer: false,
          tasks: false,
          kanban: false,
          notes: false,
          spotify: false,
          appleMusic: false,
          applePodcast: false,
          stocks: false,
          currencies: false,
        },
        placements: {
          clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
          calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 2 },
          timer: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          kanban: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
          notes: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          spotify: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          appleMusic: { column: 1, row: 2, columnSpan: 1, rowSpan: 2 },
          applePodcast: { column: 2, row: 4, columnSpan: 1, rowSpan: 2 },
          stocks: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
          currencies: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
        },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    expect(screen.queryByText('Calendar Feeds')).not.toBeInTheDocument()
    expect(screen.queryByText('Weather Display')).not.toBeInTheDocument()
    expect(screen.queryByText('Finance Widgets')).not.toBeInTheDocument()
    expect(screen.queryByText('Music Embeds')).not.toBeInTheDocument()
    expect(screen.queryByText('Pomodoro Intervals')).not.toBeInTheDocument()
  })

  it('shows only the matching music settings for widgets on the layout', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: {
          clock: true,
          weather: false,
          calendar: false,
          timer: false,
          tasks: false,
          kanban: false,
          notes: false,
          spotify: false,
          appleMusic: true,
          applePodcast: false,
          stocks: false,
          currencies: false,
        },
        placements: {
          clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
          calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 2 },
          timer: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          kanban: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
          notes: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          spotify: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          appleMusic: { column: 1, row: 2, columnSpan: 1, rowSpan: 2 },
          applePodcast: { column: 2, row: 4, columnSpan: 1, rowSpan: 2 },
          stocks: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
          currencies: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
        },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    expect(screen.getByText('Music Embeds')).toBeInTheDocument()
    expect(screen.getByText('Apple Music saved links')).toBeInTheDocument()
    expect(screen.queryByText('Spotify saved links')).not.toBeInTheDocument()
    expect(screen.queryByText('Apple Podcast saved links')).not.toBeInTheDocument()
  })

  it('persists custom theme colors when the custom theme is selected', () => {
    renderSettingsDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const customColorsSection = screen.getByText('Custom Colors').closest('section')
    const primaryColorInput = customColorsSection?.querySelector('input[type="color"]')
    expect(primaryColorInput).not.toBeNull()
    fireEvent.change(primaryColorInput as HTMLInputElement, {
      target: { value: '#112233' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gradient' }))
    const gradientColorInputs = customColorsSection?.querySelectorAll('input[type="color"]')
    expect(gradientColorInputs?.length).toBeGreaterThanOrEqual(4)
    fireEvent.change(gradientColorInputs?.[2] as HTMLInputElement, {
      target: { value: '#0f172a' },
    })
    fireEvent.change(gradientColorInputs?.[3] as HTMLInputElement, {
      target: { value: '#1d4ed8' },
    })
    fireEvent.change(customColorsSection?.querySelector('input[type="number"]') as HTMLInputElement, {
      target: { value: '135' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      theme: 'custom',
      customColors: expect.objectContaining({
        primary: '#112233',
        background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
      }),
    })
  })

  it('creates a preset with an auto-apply window', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))

    fireEvent.change(screen.getByPlaceholderText('Work Focus'), {
      target: { value: 'Work Focus' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Auto-apply off/i }))

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '17:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply on Friday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))

    expect(screen.getByText('Work Focus')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      'Work Focus': {
        name: 'Work Focus',
        settings: {
          theme: 'default',
          colorScheme: 'system',
          fontPreset: 'space-grotesk',
        },
        layout: {
          rowCount: 3,
          visibility: {
            clock: true,
            weather: true,
            calendar: true,
            timer: true,
            timezoneClock: false,
          },
          placements: {
            clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          },
        },
        schedule: {
          enabled: true,
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday'],
        },
      },
    })
  })

  it('saves the current setup into a new preset', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: 'retro',
        colorScheme: 'dark',
      }),
    )
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        rowCount: 3,
        visibility: {
          clock: true,
          weather: true,
          calendar: true,
          timer: true,
        },
        placements: {
          clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
          calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
          timer: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
        },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))
    fireEvent.change(screen.getByPlaceholderText('Work Focus'), {
      target: { value: 'Deep Work' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      theme: 'retro',
      colorScheme: 'dark',
    })
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}')).toMatchObject({
      rowCount: 3,
      visibility: {
        clock: true,
        weather: true,
        calendar: true,
        timer: true,
      },
      placements: {
        clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
      },
    })
  })

  it('preserves current light or dark mode when creating a preset', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        colorScheme: 'dark',
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))
    fireEvent.change(screen.getByPlaceholderText('Work Focus'), {
      target: { value: 'Night Focus' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))

    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      'Night Focus': {
        settings: {
          colorScheme: 'dark',
        },
      },
    })
  })

  it('renames an existing preset from the presets tab', () => {
    localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({
        Work: {
          name: 'Work',
          settings: { colorScheme: 'light' },
          createdAt: 1,
          updatedAt: 1,
        },
      }),
    )

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Deep Work')

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    expect(promptSpy).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      'Deep Work': {
        name: 'Deep Work',
      },
    })
    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}').Work).toBeUndefined()
    promptSpy.mockRestore()
  })

  it('does not overwrite an existing preset when renaming', () => {
    localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({
        Work: {
          name: 'Work',
          settings: { colorScheme: 'light' },
          createdAt: 1,
          updatedAt: 1,
        },
        Home: {
          name: 'Home',
          settings: { colorScheme: 'dark' },
          createdAt: 2,
          updatedAt: 2,
        },
      }),
    )

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Home')

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))

    const workCard = screen.getByText('Work').closest('article')
    expect(workCard).not.toBeNull()
    fireEvent.click(within(workCard as HTMLElement).getByRole('button', { name: 'Rename' }))

    expect(screen.getByText("Preset 'Home' already exists")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      Work: { name: 'Work' },
      Home: { name: 'Home' },
    })
    promptSpy.mockRestore()
  })

  it('supports keyboard navigation between settings tabs', () => {
    renderSettingsDialog()

    const sidebar = screen.getByRole('tablist', { name: /Settings sections/i })
    expect(sidebar).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: /Appearance/i }), {
      key: 'ArrowRight',
    })

    expect(screen.getByRole('tab', { name: /Layout/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps preset shortcuts out of the layout and appearance tabs', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))

    expect(screen.queryByText('New preset name')).not.toBeInTheDocument()
    expect(screen.queryByText('Existing preset')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Appearance/i }))

    expect(screen.queryByText('New preset name')).not.toBeInTheDocument()
    expect(screen.queryByText('Existing preset')).not.toBeInTheDocument()
  })

  it('saves layout edits back to the selected preset when saving settings', () => {
    localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({
        Work: {
          name: 'Work',
          settings: { colorScheme: 'light' },
          createdAt: 1,
          updatedAt: 1,
        },
      }),
    )

    renderSettingsDialog('Work')
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      Work: {
        layout: {
          rowCount: 4,
        },
      },
    })
  })

  it('loads a preset from the presets tab and saves changes from the preset card', () => {
    localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({
        Work: {
          name: 'Work',
          settings: {
            colorScheme: 'light',
            theme: 'default',
            fontPreset: 'space-grotesk',
            showBuyMeACoffeeWidget: true,
            calendarFeeds: [],
            calendarHidePastEvents: false,
            calendarShowMonthlyOverview: true,
            calendarExtraInfoPreview: 'monthly',
            calendarShowAllDayEvents: true,
            calendarWeekStartsOn: 'monday',
            weatherRefreshMinutes: 10,
            weatherUnitSystem: 'metric',
            weatherShowExtraDetails: true,
            spotifyEmbedUrl: '',
            spotifyEmbedLinks: [],
            appleMusicEmbedUrl: '',
            appleMusicEmbedLinks: [],
            applePodcastEmbedUrl: '',
            applePodcastEmbedLinks: [],
            stockSymbols: ['AAPL'],
            currencyPairs: [['USD', 'EUR']],
            financeRefreshMinutes: 10,
            pomodoroWorkMinutes: 25,
            pomodoroBreakMinutes: 5,
            worldClockCity: 'New York',
            worldClockTimeZone: 'America/New_York',
            customColors: {
              primary: '#4f46e5',
              primaryHover: '#4338ca',
              background: '#0f172a',
              fontColor: '#f5f5f5',
              secondaryFontColor: '#999999',
            },
          },
          createdAt: 1,
          updatedAt: 1,
        },
      }),
    )

    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('tab', { name: /Appearance/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('tab', { name: /Presets/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save current' }))

    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      Work: {
        settings: {
          colorScheme: 'dark',
        },
      },
    })
  })
})
