import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsDialog } from '../SettingsDialog'
import { SettingsProvider } from '../../lib/useSettings'

const LAYOUT_STORAGE_KEY = 'dayboard_widget_layout'
const SETTINGS_STORAGE_KEY = 'dayboard:settings'

function renderSettingsDialog() {
  return render(
    <SettingsProvider>
      <SettingsDialog onClose={() => {}} />
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

    expect(screen.getByTestId('layout-widget-clock')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-widget-weather')).not.toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-timer')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-tasks')).toBeInTheDocument()
  })

  it('removes a widget from the grid when the × button is clicked', () => {
    renderSettingsDialog()

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

    fireEvent.click(screen.getByRole('button', { name: /Show monthly overview/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarShowMonthlyOverview: false,
    })
  })

  it('persists the calendar week start setting', () => {
    renderSettingsDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Sunday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarWeekStartsOn: 'sunday',
    })
  })

  it('shows the past events toggle as pressed only when past events are visible', () => {
    renderSettingsDialog()

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
})
