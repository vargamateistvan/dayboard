import { describe, it, expect, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { WidgetLayoutEditor } from '../WidgetLayoutEditor'
import {
  findRemovableRow,
  insertGridRow,
  loadWidgetLayoutState,
  removeGridRow,
  resolveWidgetDrop,
  resolveWidgetDropWithNewRows,
  useWidgetVisibility,
} from '../../lib/useWidgetVisibility'

// Default layout (2 cols x 3 rows):
// clock(1,1,2x1)
// weather(1,2)  calendar(2,2,1x2)
// timer(1,3)

function Harness() {
  const { order, visibility, placements, rowCount, placeWidgets, toggleWidget, insertRow, deleteRow } =
    useWidgetVisibility()
  return (
    <WidgetLayoutEditor
      order={order}
      visibility={visibility}
      placements={placements}
      rowCount={rowCount}
      onPlaceWidgets={placeWidgets}
      onToggleWidget={toggleWidget}
      onInsertRow={insertRow}
      onDeleteRow={deleteRow}
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

describe('row helpers', () => {
  beforeEach(() => localStorage.clear())

  it('inserts a row and shifts widgets at or below it', () => {
    const next = insertGridRow(loadWidgetLayoutState(), 2)!
    expect(next.rowCount).toBe(4)
    expect(next.placements.clock).toMatchObject({ row: 1 })
    expect(next.placements.weather).toMatchObject({ row: 3 })
    expect(next.placements.calendar).toMatchObject({ row: 3, rowSpan: 2 })
    expect(next.placements.timer).toMatchObject({ row: 4 })
  })

  it('deletes a row, shrinking spanning widgets and hiding ones that no longer fit', () => {
    const layout = insertGridRow(loadWidgetLayoutState(), 4)!
    const removal = removeGridRow(layout, 3)!
    expect(removal.shrunk).toEqual(['calendar'])
    expect(removal.removed).toEqual(['timer'])
    expect(removal.layout.rowCount).toBe(3)
    expect(removal.layout.placements.calendar).toMatchObject({ row: 2, rowSpan: 1 })
    expect(removal.layout.visibility.timer).toBe(false)
  })

  it('refuses to go below the minimum row count', () => {
    const layout = removeGridRow(insertGridRow(loadWidgetLayoutState(), 4)!, 4)!.layout
    const twoRows = removeGridRow({ ...layout, visibility: { ...layout.visibility, timer: false } }, 3)!.layout
    expect(twoRows.rowCount).toBe(2)
    expect(removeGridRow(twoRows, 1)).toBeNull()
  })

  it('picks an empty row before one that shrinks a widget', () => {
    const layout = loadWidgetLayoutState()
    expect(findRemovableRow(layout)).toBeNull()

    layout.visibility.timer = false
    expect(findRemovableRow(layout)).toBe(3)
    expect(findRemovableRow(insertGridRow(layout, 2)!)).toBe(2)
  })

  it('adds as few rows as needed to place a widget below a full grid', () => {
    const layout = loadWidgetLayoutState()
    expect(resolveWidgetDropWithNewRows(layout, 'tasks', [{ columnSpan: 1, rowSpan: 1 }], 2)).toEqual({
      target: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 },
      patch: { tasks: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 } },
      rowCount: 4,
    })
    expect(
      resolveWidgetDropWithNewRows(layout, 'appleMusic', [{ columnSpan: 1, rowSpan: 2 }], 1)?.rowCount,
    ).toBe(5)
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

  it('disables the remove-row button when every row would lose a widget', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Remove row' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Timer from dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove row' }))

    expect(screen.getByText('2 of 6 rows')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-calendar')).toHaveAccessibleName('Calendar, column 2, row 2, 1 by 1')
  })

  it('inserts a row above a specific row', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Insert a row above row 2' }))

    expect(screen.getByText('4 of 6 rows')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-weather')).toHaveAccessibleName('Weather, column 1, row 3, 1 by 1')
    expect(screen.getByTestId('layout-widget-clock')).toHaveAccessibleName('Clock, column 1, row 1, 2 by 1')
  })

  it('deletes a specific row and says which widgets it removes', () => {
    render(<Harness />)
    const deleteRow2 = screen.getByRole('button', { name: 'Delete row 2 — shrinks Calendar — removes Weather' })

    fireEvent.mouseEnter(deleteRow2)
    expect(screen.getByTestId('layout-widget-weather').className).toMatch(/layoutWidgetDoomed/)

    fireEvent.click(deleteRow2)
    expect(screen.queryByTestId('layout-widget-weather')).not.toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-timer')).toHaveAccessibleName('Timer, column 1, row 2, 1 by 1')
    expect(screen.getByText('Deleted row 2 and removed Weather from dashboard')).toBeInTheDocument()
  })

  it('adds a row when a widget is dropped below the grid', () => {
    render(<Harness />)
    mockGridRect()
    const tasks = screen.getByRole('button', { name: 'Add Tasks to dashboard' })

    fireEvent.pointerDown(tasks, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 500, clientY: 500 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 504, clientY: 500 })
    const zone = screen.getByText('Drop here to add a row').parentElement as HTMLElement
    zone.getBoundingClientRect = () =>
      ({ left: 0, top: 310, right: 200, bottom: 350, width: 200, height: 40, x: 0, y: 310 }) as DOMRect
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, clientY: 330 })
    expect(screen.getByText('Release to add a row for Tasks')).toBeInTheDocument()
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 150, clientY: 330 })

    expect(screen.getByText('4 of 6 rows')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-tasks')).toHaveAccessibleName('Tasks, column 2, row 4, 1 by 1')
  })

  it('adds a row when a widget is clicked in the palette and the grid is full', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Apple Music Player to dashboard' }))

    expect(screen.getByText('5 of 6 rows')).toBeInTheDocument()
    expect(screen.getByTestId('layout-widget-appleMusic')).toHaveAccessibleName('Apple Music Player, column 1, row 4, 1 by 2')
  })
})
