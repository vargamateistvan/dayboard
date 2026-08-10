import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsDialog } from '../SettingsDialog'
import { SettingsProvider } from '../../lib/useSettings'

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
        },
        placements: {
          clock:    { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
          weather:  { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
          calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
          timer:    { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
          tasks:    { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
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

  it('removes a widget from the grid when the × button is clicked', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Layout/i }))

    // 4 widgets are visible by default (tasks is hidden)
    expect(screen.getByTestId('layout-widget-weather')).toBeInTheDocument()

    // Click the × button to remove weather from the dashboard
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weather from dashboard' }))

    // Weather should no longer appear in the grid
    expect(screen.queryByTestId('layout-widget-weather')).not.toBeInTheDocument()

    // The palette should show weather as a hidden chip (with grip icon present)
    expect(screen.getByTitle('Drag to add Weather')).toBeInTheDocument()
  })

  it('persists the monthly overview toggle with calendar display settings', () => {
    renderSettingsDialog()
    fireEvent.click(screen.getByRole('tab', { name: /Widgets/i }))

    fireEvent.click(screen.getByRole('button', { name: /Show monthly overview/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarShowMonthlyOverview: false,
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
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))

    expect(screen.getByText('Work Focus')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')).toMatchObject({
      'Work Focus': {
        name: 'Work Focus',
        schedule: {
          enabled: true,
          startTime: '09:00',
          endTime: '17:00',
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
