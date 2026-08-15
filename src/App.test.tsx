import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import styles from './App.module.css'
import type { Widget } from './lib/useWidgetVisibility'

const PRESET_STORAGE_KEY = 'dayboard:settings-presets'
const SETTINGS_STORAGE_KEY = 'dayboard:settings'
const ACTIVE_PRESET_STORAGE_KEY = 'dayboard:active-preset'

const widgetVisibility: Record<Widget, boolean> = {
  clock: true,
  timezoneClock: false,
  weather: true,
  astronomy: false,
  flights: false,
  calendar: false,
  timer: false,
  tasks: false,
  kanban: false,
  notes: false,
  spotify: false,
  appleMusic: false,
  applePodcast: false,
  stocks: false,
  sports: false,
  currencies: false,
  quote: false,
  deviceInfo: false,
}

const DEFAULT_WIDGET_VISIBILITY: Record<Widget, boolean> = {
  clock: true,
  timezoneClock: false,
  weather: true,
  astronomy: false,
  flights: false,
  calendar: false,
  timer: false,
  tasks: false,
  kanban: false,
  notes: false,
  spotify: false,
  appleMusic: false,
  applePodcast: false,
  stocks: false,
  sports: false,
  currencies: false,
  quote: false,
  deviceInfo: false,
}

const DEFAULT_WIDGET_ORDER: Widget[] = ['clock', 'weather']

const widgetOrder: Widget[] = [...DEFAULT_WIDGET_ORDER]

type TestPreset = {
  name: string
  settings: {
    colorScheme: 'light' | 'dark'
  }
  createdAt: number
  updatedAt: number
}

const widgetPlacements = {
  clock: { column: 1, row: 1, columnSpan: 1, rowSpan: 1 },
  timezoneClock: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
  weather: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
  astronomy: { column: 1, row: 6, columnSpan: 1, rowSpan: 1 },
  flights: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
  calendar: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
  timer: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
  tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
  kanban: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
  notes: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
  spotify: { column: 1, row: 4, columnSpan: 1, rowSpan: 1 },
  appleMusic: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 },
  applePodcast: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
  stocks: { column: 1, row: 6, columnSpan: 1, rowSpan: 1 },
  sports: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
  currencies: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
  quote: { column: 1, row: 7, columnSpan: 1, rowSpan: 1 },
  deviceInfo: { column: 2, row: 7, columnSpan: 1, rowSpan: 1 },
}

vi.mock('./lib/useEventNotifications', () => ({
  useEventNotifications: () => ({
    notifications: [],
    dismissNotification: vi.fn(),
  }),
}))

vi.mock('./lib/useFocusMode', () => ({
  useFocusMode: () => ({
    focusMode: false,
    toggleFocusMode: vi.fn(),
  }),
}))

vi.mock('./lib/useWidgetVisibility', () => ({
  useWidgetVisibility: () => ({
    visibility: widgetVisibility,
    order: widgetOrder,
    placements: widgetPlacements,
    rowCount: 2,
  }),
}))

vi.mock('./components/ClockWidget', () => ({
  ClockWidget: () => <div>Clock widget</div>,
}))

vi.mock('./components/WeatherWidget', () => ({
  WeatherWidget: () => <div>Weather widget</div>,
}))

vi.mock('./components/AstronomyWidget', () => ({
  AstronomyWidget: () => <div>Astronomy widget</div>,
}))

vi.mock('./components/FlightWidget', () => ({
  FlightWidget: () => <div>Flights widget</div>,
}))

vi.mock('./components/TimezoneClockWidget', () => ({
  TimezoneClockWidget: () => <div>Timezone clock widget</div>,
}))

vi.mock('./components/CalendarWidget', () => ({
  CalendarWidget: () => <div>Calendar widget</div>,
}))

vi.mock('./components/TimerPanel', () => ({
  TimerPanel: () => <div>Timer widget</div>,
}))

vi.mock('./components/TaskWidget', () => ({
  TaskWidget: () => <div>Task widget</div>,
}))

vi.mock('./components/MiniKanbanWidget', () => ({
  MiniKanbanWidget: () => <div>Mini kanban widget</div>,
}))

vi.mock('./components/NotesWidget', () => ({
  NotesWidget: () => <div>Notes widget</div>,
}))

vi.mock('./components/SpotifyWidget', () => ({
  SpotifyWidget: () => <div>Spotify widget</div>,
}))

vi.mock('./components/AppleMusicWidget', () => ({
  AppleMusicWidget: () => <div>Apple Music widget</div>,
}))

vi.mock('./components/ApplePodcastWidget', () => ({
  ApplePodcastWidget: () => <div>Apple podcast widget</div>,
}))

vi.mock('./components/StockWidget', () => ({
  StockWidget: () => <div>Stocks widget</div>,
}))

vi.mock('./components/CurrencyWidget', () => ({
  CurrencyWidget: () => <div>Currencies widget</div>,
}))

vi.mock('./components/QuoteWidget', () => ({
  QuoteWidget: () => <div>Quote widget</div>,
}))

vi.mock('./components/DeviceInfoWidget', () => ({
  DeviceInfoWidget: () => <div>Device info widget</div>,
}))

vi.mock('./components/BuyMeCoffeeWidget', () => ({
  BuyMeCoffeeWidget: () => null,
}))

vi.mock('./components/SettingsDialog', async () => {
  const { useSettings } = await import('./lib/useSettings')

  return {
    SettingsDialog: () => {
      const { updateSettings } = useSettings()

      return (
        <button
          type="button"
          onClick={() => updateSettings({ colorScheme: 'system' })}
        >
          Mock diverge settings
        </button>
      )
    },
  }
})

vi.mock('./components/NotificationBadge', () => ({
  NotificationBadge: () => null,
}))

function setWidgetState(
  overrides: Partial<Record<Widget, boolean>> = {},
  order: Widget[] = DEFAULT_WIDGET_ORDER,
) {
  Object.assign(widgetVisibility, DEFAULT_WIDGET_VISIBILITY, overrides)
  widgetOrder.splice(0, widgetOrder.length, ...order)
}

function createPreset(name: string, colorScheme: 'light' | 'dark', timestamp: number): TestPreset {
  return {
    name,
    settings: { colorScheme },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function seedPresets(...presets: TestPreset[]) {
  localStorage.setItem(
    PRESET_STORAGE_KEY,
    JSON.stringify(Object.fromEntries(presets.map((preset) => [preset.name, preset]))),
  )
}

beforeEach(() => {
  localStorage.clear()
  setWidgetState()
})

describe('App fullscreen widgets', () => {
  it('toggles fullscreen mode for a widget', () => {
    render(<App />)

    const weatherCell = document.querySelector('[data-widget-id="weather"]')
    const clockCell = document.querySelector('[data-widget-id="clock"]')

    expect(weatherCell).not.toBeNull()
    expect(clockCell).not.toBeNull()
    expect(weatherCell).not.toHaveClass(styles.widgetCellFullscreen)
    expect(clockCell).not.toHaveClass(styles.widgetCellHidden)

    fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen for Weather' }))

    expect(weatherCell).toHaveClass(styles.widgetCellFullscreen)
    expect(clockCell).toHaveClass(styles.widgetCellHidden)
    expect(screen.getByRole('button', { name: 'Exit fullscreen for Weather' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen for Weather' }))

    expect(weatherCell).not.toHaveClass(styles.widgetCellFullscreen)
    expect(clockCell).not.toHaveClass(styles.widgetCellHidden)
  })

  it('supports fullscreen mode for the flights radar widget', () => {
    setWidgetState({ clock: false, weather: false, flights: true }, ['flights'])

    render(<App />)

    const flightsCell = document.querySelector('[data-widget-id="flights"]')
    expect(flightsCell).not.toBeNull()
    expect(flightsCell).not.toHaveClass(styles.widgetCellFullscreen)

    fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen for Flights Radar' }))

    expect(flightsCell).toHaveClass(styles.widgetCellFullscreen)
    expect(screen.getByRole('button', { name: 'Exit fullscreen for Flights Radar' })).toBeInTheDocument()

    setWidgetState()
  })

  it('opens the info dialog with usage guidance and the issue tracker link', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Open app info' }))

    expect(screen.getByRole('dialog', { name: 'About Dayboard' })).toBeInTheDocument()
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText(/Use the settings button to control widget visibility/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'github.com/vargamateistvan/dayboard/issues' }),
    ).toHaveAttribute('href', 'https://github.com/vargamateistvan/dayboard/issues')
  })

  it('shows a preset selector when more than one preset exists', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))

    expect(screen.getByLabelText('Preset options')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument()
  })

  it('closes the preset menu when Escape is pressed', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))
    expect(screen.getByLabelText('Preset options')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByLabelText('Preset options')).not.toBeInTheDocument()
  })

  it('closes the preset menu when clicking outside', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))
    expect(screen.getByLabelText('Preset options')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByLabelText('Preset options')).not.toBeInTheDocument()
  })

  it('applies a selected preset from the preset menu', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))

    expect(screen.getByRole('button', { name: 'Select preset' })).toHaveTextContent('Focus')
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      colorScheme: 'dark',
    })
  })

  it('keeps showing the selected preset while editing even when settings diverge', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.getByRole('button', { name: 'Select preset' })).toHaveTextContent('Work')

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mock diverge settings' }))

    expect(screen.getByRole('button', { name: 'Select preset' })).toHaveTextContent('Work')
  })

  it('persists the active preset name in localStorage', () => {
    seedPresets(createPreset('Work', 'light', 1), createPreset('Focus', 'dark', 2))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Select preset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))

    expect(localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY)).toBe('Focus')
  })
})
