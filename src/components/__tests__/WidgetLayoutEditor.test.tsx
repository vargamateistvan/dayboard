import { describe, it, expect, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { WidgetLayoutEditor } from '../WidgetLayoutEditor'
import {
  loadWidgetLayoutState,
  resolveWidgetDrop,
  useWidgetVisibility,
} from '../../lib/useWidgetVisibility'

// Default layout (2 cols x 3 rows):
// clock(1,1,2x1)
// weather(1,2)  calendar(2,2,1x2)
// timer(1,3)

function Harness() {
  const { order, visibility, placements, rowCount, placeWidgets, toggleWidget, addRow, removeRow } =
    useWidgetVisibility()
  return (
    <WidgetLayoutEditor
      order={order}
      visibility={visibility}
      placements={placements}
      rowCount={rowCount}
      onPlaceWidgets={placeWidgets}
      onToggleWidget={toggleWidget}
      onAddRow={addRow}
      onRemoveRow={removeRow}
    />
  )
}

// 200x300 grid → 100px cells across 2 columns and 3 rows.
function mockGridRect() {
  const grid = screen.getByTestId('layout-widget-clock').parentElement as HTMLElement
  grid.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 200, bottom: 300, width: 200, height: 300, x: 0, y: 0 }) as DOMRect
}

function drag(element: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: from[0], clientY: from[1] })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: to[0], clientY: to[1] })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: to[0], clientY: to[1] })
}

describe('resolveWidgetDrop', () => {
  beforeEach(() => localStorage.clear())

  it('moves a widget into a free spot', () => {
    const layout = loadWidgetLayoutState()
    layout.visibility.timer = false
    const target = { column: 1 as const, row: 3, columnSpan: 1 as const, rowSpan: 1 }
    expect(resolveWidgetDrop(layout, 'weather', target)).toEqual({ weather: target })
  })

  it('swaps with the single widget under the drop target', () => {
    const layout = loadWidgetLayoutState()
    expect(
      resolveWidgetDrop(layout, 'weather', { column: 1, row: 3, columnSpan: 1, rowSpan: 1 }),
    ).toEqual({
      weather: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
      timer: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
    })
  })

  it('refuses a swap that would not fit', () => {
    const layout = loadWidgetLayoutState()
    // Calendar is 1x2 and would overlap the timer at weather's old spot.
    expect(
      resolveWidgetDrop(layout, 'weather', { column: 2, row: 2, columnSpan: 1, rowSpan: 1 }),
    ).toBeNull()
  })

  it('does not swap when a hidden widget is dropped on an occupied spot', () => {
    const layout = loadWidgetLayoutState()
    expect(
      resolveWidgetDrop(layout, 'tasks', { column: 1, row: 3, columnSpan: 1, rowSpan: 1 }),
    ).toBeNull()
  })
})

describe('WidgetLayoutEditor', () => {
  beforeEach(() => localStorage.clear())

  it('places a palette widget where it is dropped, not in the first free slot', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weather from dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Timer from dashboard' }))
    mockGridRect()

    drag(screen.getByRole('button', { name: 'Add Tasks to dashboard' }), [500, 500], [50, 250])

    expect(screen.getByTestId('layout-widget-tasks')).toHaveAccessibleName('Tasks, column 1, row 3, 1 by 1')
  })

  it('keeps the grab point under the pointer when moving a tall widget', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weather from dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Timer from dashboard' }))
    mockGridRect()

    // Grab the calendar by its bottom half (row 3) and drop on column 1, row 3.
    drag(screen.getByTestId('layout-widget-calendar'), [150, 250], [50, 250])

    expect(screen.getByTestId('layout-widget-calendar')).toHaveAccessibleName('Calendar, column 1, row 2, 1 by 2')
  })

  it('swaps two widgets by dragging one onto the other', () => {
    render(<Harness />)
    mockGridRect()

    drag(screen.getByTestId('layout-widget-weather'), [50, 150], [50, 250])

    expect(screen.getByTestId('layout-widget-weather')).toHaveAccessibleName('Weather, column 1, row 3, 1 by 1')
    expect(screen.getByTestId('layout-widget-timer')).toHaveAccessibleName('Timer, column 1, row 2, 1 by 1')
    expect(screen.getByText('Swapped Weather with Timer')).toBeInTheDocument()
  })

  it('cancels a drag with Escape', () => {
    render(<Harness />)
    mockGridRect()
    const weather = screen.getByTestId('layout-widget-weather')

    fireEvent.pointerDown(weather, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 150 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 250 })
    expect(screen.getByText('Swap with Timer')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 250 })

    expect(screen.queryByText('Swap with Timer')).not.toBeInTheDocument()
    expect(weather).toHaveAccessibleName('Weather, column 1, row 2, 1 by 1')
  })

  it('moves, resizes and removes widgets from the keyboard', () => {
    render(<Harness />)

    fireEvent.keyDown(screen.getByTestId('layout-widget-weather'), { key: 'ArrowDown' })
    expect(screen.getByTestId('layout-widget-weather')).toHaveAccessibleName('Weather, column 1, row 3, 1 by 1')

    fireEvent.keyDown(screen.getByTestId('layout-widget-timer'), { key: 'Delete' })
    expect(screen.queryByTestId('layout-widget-timer')).not.toBeInTheDocument()

    fireEvent.keyDown(screen.getByTestId('layout-widget-weather'), { key: 'ArrowUp', shiftKey: true })
    expect(screen.getByText("Weather can't be resized that way")).toBeInTheDocument()

    fireEvent.keyDown(screen.getByTestId('layout-widget-weather'), { key: 'ArrowUp' })
    fireEvent.keyDown(screen.getByTestId('layout-widget-weather'), { key: 'ArrowDown', shiftKey: true })
    expect(screen.getByTestId('layout-widget-weather')).toHaveAccessibleName('Weather, column 1, row 2, 1 by 2')
  })
})
