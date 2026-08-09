import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import styles from './App.module.css'
import type { Widget } from './lib/useWidgetVisibility'

const widgetVisibility = {
  clock: true,
  timezoneClock: false,
  weather: true,
  calendar: false,
  timer: false,
  tasks: false,
  notes: false,
  spotify: false,
  appleMusic: false,
  applePodcast: false,
  stocks: false,
  currencies: false,
  quote: false,
} satisfies Record<Widget, boolean>

const widgetPlacements = {
  clock: { column: 1, row: 1, columnSpan: 1, rowSpan: 1 },
  timezoneClock: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
  weather: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
  calendar: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
  timer: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
  tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
  notes: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
  spotify: { column: 1, row: 4, columnSpan: 1, rowSpan: 1 },
  appleMusic: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 },
  applePodcast: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
  stocks: { column: 1, row: 6, columnSpan: 1, rowSpan: 1 },
  currencies: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
  quote: { column: 1, row: 7, columnSpan: 1, rowSpan: 1 },
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
    order: ['clock', 'weather'],
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

vi.mock('./components/BuyMeCoffeeWidget', () => ({
  BuyMeCoffeeWidget: () => null,
}))

vi.mock('./components/SettingsDialog', () => ({
  SettingsDialog: () => <div>Settings dialog</div>,
}))

vi.mock('./components/NotificationBadge', () => ({
  NotificationBadge: () => null,
}))

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
})
