import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useWidgetVisibility } from '../useWidgetVisibility'

const LAYOUT_STORAGE_KEY = 'dayboard_widget_layout'
const LEGACY_VISIBILITY_STORAGE_KEY = 'dayboard_widget_visibility'

// Default placements (2 cols x 3 rows):
// clock(1,1,2,1)    – full width row 1
// weather(1,2,1,1)  calendar(2,2,1,2)  – col 2 spans rows 2-3
// timer(1,3,1,1)                        – col 1 row 3
// tasks hidden by default

function Probe({ label }: { label: string }) {
  const { visibility, order, placements, toggleWidget, moveWidget, setWidgetPlacement } =
    useWidgetVisibility()

  return (
    <div>
      <span data-testid={`weather-${label}`}>{String(visibility.weather)}</span>
      <span data-testid={`order-${label}`}>{order.join(',')}</span>
      <span data-testid={`weather-placement-${label}`}>
        {[
          placements.weather.column,
          placements.weather.row,
          placements.weather.columnSpan,
          placements.weather.rowSpan,
        ].join(',')}
      </span>
      <span data-testid={`clock-placement-${label}`}>
        {[
          placements.clock.column,
          placements.clock.row,
          placements.clock.columnSpan,
          placements.clock.rowSpan,
        ].join(',')}
      </span>
      <span data-testid={`apple-placement-${label}`}>
        {[
          placements.appleMusic.column,
          placements.appleMusic.row,
          placements.appleMusic.columnSpan,
          placements.appleMusic.rowSpan,
        ].join(',')}
      </span>
      <span data-testid={`stocks-placement-${label}`}>
        {[
          placements.stocks.column,
          placements.stocks.row,
          placements.stocks.columnSpan,
          placements.stocks.rowSpan,
        ].join(',')}
      </span>
      <span data-testid={`currencies-placement-${label}`}>
        {[
          placements.currencies.column,
          placements.currencies.row,
          placements.currencies.columnSpan,
          placements.currencies.rowSpan,
        ].join(',')}
      </span>

      {/* toggle buttons */}
      <button onClick={() => toggleWidget('weather')}  aria-label={`toggle-${label}`}>toggle</button>
      <button onClick={() => toggleWidget('timer')}    aria-label={`toggle-timer-${label}`}>toggle timer</button>
      <button onClick={() => toggleWidget('tasks')}    aria-label={`toggle-tasks-${label}`}>toggle tasks</button>
      <button onClick={() => toggleWidget('calendar')} aria-label={`toggle-calendar-${label}`}>toggle calendar</button>

      {/* move buttons */}
      <button onClick={() => moveWidget('weather', 'right')} aria-label={`move-right-${label}`}>move right</button>
      <button onClick={() => moveWidget('calendar', 'up')}   aria-label={`move-calendar-up-${label}`}>move calendar up</button>

      {/* placement setters */}
      <button
        onClick={() => setWidgetPlacement('clock', { ...placements.clock, columnSpan: 1, rowSpan: 1 })}
        aria-label={`shrink-clock-${label}`}
      >shrink clock</button>

      <button
        onClick={() => setWidgetPlacement('weather', { ...placements.weather, columnSpan: 1, rowSpan: 2 })}
        aria-label={`grow-weather-tall-${label}`}
      >grow weather tall</button>

      <button
        onClick={() => setWidgetPlacement('clock', { ...placements.clock, columnSpan: 2, rowSpan: 3 })}
        aria-label={`grow-clock-fullheight-${label}`}
      >grow clock full height</button>

      <button
        onClick={() => setWidgetPlacement('clock', { ...placements.clock, columnSpan: 2, rowSpan: 2 })}
        aria-label={`grow-clock-twobytwo-${label}`}
      >grow clock 2x2</button>

      <button
        onClick={() => setWidgetPlacement('appleMusic', { ...placements.appleMusic, columnSpan: 1, rowSpan: 1 })}
        aria-label={`shrink-apple-${label}`}
      >shrink apple</button>
    </div>
  )
}

describe('useWidgetVisibility', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shares widget visibility across consumers', () => {
    render(
      <div>
        <Probe label="left" />
        <Probe label="right" />
      </div>,
    )

    expect(screen.getAllByText('true')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'toggle-left' }))
    expect(screen.getAllByText('false')).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').visibility.weather).toBe(false)
    expect(JSON.parse(localStorage.getItem(LEGACY_VISIBILITY_STORAGE_KEY) ?? '{}').weather).toBe(false)
  })

  it('orders widgets by their grid placement', () => {
    render(<Probe label="grid" />)

    // Default: clock(1,1), weather(1,2), calendar(2,2 rowSpan 2), timer(1,3); tasks hidden but placement ties at (1,3)
    expect(screen.getByTestId('order-grid').textContent).toBe(
      'clock,weather,appleMusic,calendar,timer,tasks,notes,spotify,applePodcast,stocks,currencies',
    )
  })

  it('restores legacy visibility and default placements', () => {
    localStorage.setItem(
      LEGACY_VISIBILITY_STORAGE_KEY,
      JSON.stringify({ weather: false, clock: true }),
    )
    render(<Probe label="legacy" />)

    expect(screen.getByTestId('weather-legacy').textContent).toBe('false')
    expect(screen.getByTestId('clock-placement-legacy').textContent).toBe('1,1,2,1')
    expect(screen.getByTestId('weather-placement-legacy').textContent).toBe('1,2,1,1')
  })

  it('migrates old order and column-span storage to placements', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        visibility: { clock: true, weather: true, calendar: true, timer: true, tasks: true },
        order: ['weather', 'clock', 'calendar', 'timer', 'tasks', 'notes', 'spotify', 'appleMusic'],
        columnSpans: { weather: 2, clock: 1 },
      }),
    )
    render(<Probe label="migrate" />)

    // weather first with span=2 → (1,1,2,1); clock (falls back to default span=2) → (1,2,2,1)
    expect(screen.getByTestId('weather-placement-migrate').textContent).toBe('1,1,2,1')
    expect(screen.getByTestId('clock-placement-migrate').textContent).toBe('1,2,2,1')
  })

  it('supports making a widget two rows tall when space is available', () => {
    render(<Probe label="tall" />)

    // weather(1,2,1,1). Hide timer(1,3) to free that cell, then grow weather 2 rows.
    // calendar is already at (2,2,1,2) so col 2 rows 2-3 are taken — weather can grow into (1,3)
    fireEvent.click(screen.getByRole('button', { name: 'toggle-timer-tall' }))
    fireEvent.click(screen.getByRole('button', { name: 'grow-weather-tall-tall' }))

    expect(screen.getByTestId('weather-placement-tall').textContent).toBe('1,2,1,2')
    expect(
      JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').placements.weather,
    ).toEqual({ column: 1, row: 2, columnSpan: 1, rowSpan: 2 })
  })

  it('supports making clock fill the full grid height when all other widgets are hidden', () => {
    render(<Probe label="fullheight" />)

    // Hide everything except clock (tasks is already hidden by default)
    fireEvent.click(screen.getByRole('button', { name: 'toggle-fullheight' }))       // weather
    fireEvent.click(screen.getByRole('button', { name: 'toggle-calendar-fullheight' }))
    fireEvent.click(screen.getByRole('button', { name: 'toggle-timer-fullheight' }))
    fireEvent.click(screen.getByRole('button', { name: 'grow-clock-fullheight-fullheight' }))

    expect(screen.getByTestId('clock-placement-fullheight').textContent).toBe('1,1,2,3')
    expect(
      JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').placements.clock,
    ).toEqual({ column: 1, row: 1, columnSpan: 2, rowSpan: 3 })
  })

  it('supports making clock 2x2 when enough space is available', () => {
    render(<Probe label="twobytwo" />)

    // Hide weather, calendar to free rows 2-3, then grow clock to 2x2
    // tasks is already hidden by default; timer also needs to be hidden
    fireEvent.click(screen.getByRole('button', { name: 'toggle-twobytwo' }))          // weather
    fireEvent.click(screen.getByRole('button', { name: 'toggle-calendar-twobytwo' }))
    fireEvent.click(screen.getByRole('button', { name: 'toggle-timer-twobytwo' }))
    fireEvent.click(screen.getByRole('button', { name: 'grow-clock-twobytwo-twobytwo' }))

    expect(screen.getByTestId('clock-placement-twobytwo').textContent).toBe('1,1,2,2')
    expect(
      JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').placements.clock,
    ).toEqual({ column: 1, row: 1, columnSpan: 2, rowSpan: 2 })
  })

  it('keeps apple music at minimum 1x2', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        placements: {
          appleMusic: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
        },
      }),
    )
    render(<Probe label="apple-min" />)

    expect(screen.getByTestId('apple-placement-apple-min').textContent).toBe('1,2,1,2')
  })
})
