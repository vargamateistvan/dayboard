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
})
