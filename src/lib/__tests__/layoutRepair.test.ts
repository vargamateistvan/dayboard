import { afterEach, describe, expect, it } from 'vitest'
import {
  loadWidgetLayoutState,
  MAX_GRID_ROWS,
  MIN_WIDGET_SIZE,
  normalizeWidgetLayoutState,
  resolveWidgetDrop,
  WIDGET_GRID_COLUMNS,
  WIDGET_IDS,
  type Widget,
  type WidgetLayoutState,
} from '../useWidgetVisibility'

const LAYOUT_KEY = 'dayboard_widget_layout'
const LEGACY_VISIBILITY_KEY = 'dayboard_widget_visibility'

function visibleWidgets(layout: WidgetLayoutState): Widget[] {
  return WIDGET_IDS.filter((widget) => layout.visibility[widget])
}

function cellsOf(layout: WidgetLayoutState, widget: Widget): string[] {
  const { column, row, columnSpan, rowSpan } = layout.placements[widget]
  const cells: string[] = []
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = column; c < column + columnSpan; c += 1) cells.push(`${r}:${c}`)
  }
  return cells
}

function expectValidLayout(layout: WidgetLayoutState) {
  const owners = new Map<string, Widget>()

  for (const widget of visibleWidgets(layout)) {
    const placement = layout.placements[widget]
    expect(placement.row, `${widget} row`).toBeGreaterThanOrEqual(1)
    expect(placement.row + placement.rowSpan - 1, `${widget} bottom`).toBeLessThanOrEqual(layout.rowCount)
    expect(placement.column + placement.columnSpan - 1, `${widget} right`).toBeLessThanOrEqual(WIDGET_GRID_COLUMNS)
    expect(placement.rowSpan, `${widget} min height`).toBeGreaterThanOrEqual(MIN_WIDGET_SIZE[widget].rowSpan)

    for (const cell of cellsOf(layout, widget)) {
      expect(owners.get(cell), `${widget} overlaps ${owners.get(cell)} at ${cell}`).toBeUndefined()
      owners.set(cell, widget)
    }
  }
}

function loadStored(key: string, value: unknown): WidgetLayoutState {
  localStorage.setItem(key, JSON.stringify(value))
  return loadWidgetLayoutState()
}

describe('layout repair', () => {
  afterEach(() => {
    localStorage.clear()
  })

  describe('old visibility-only layouts', () => {
    it.each([
      { clock: true, weather: true, calendar: true, timer: true, tasks: true },
      { appleMusic: true },
      { stocks: true },
      { clock: true, weather: false, calendar: false, timer: false, deviceInfo: true, flights: true, applePodcast: true },
    ])('loads %o without overlaps or widgets off the grid', (visibility) => {
      const layout = loadStored(LEGACY_VISIBILITY_KEY, visibility)

      expectValidLayout(layout)
      for (const [widget, visible] of Object.entries(visibility)) {
        expect(layout.visibility[widget as Widget], widget).toBe(visible)
      }
    })

    it('keeps as many widgets as fit when everything was visible', () => {
      const all = Object.fromEntries(WIDGET_IDS.map((widget) => [widget, true]))
      const layout = loadStored(LEGACY_VISIBILITY_KEY, all)

      expectValidLayout(layout)
      expect(layout.rowCount).toBe(MAX_GRID_ROWS)
      expect(visibleWidgets(layout).length).toBeGreaterThan(6)
    })
  })

  it('repairs a layout saved with an older grid version', () => {
    const layout = loadStored(LAYOUT_KEY, {
      gridVersion: '1x9',
      rowCount: 3,
      visibility: { clock: true, weather: true, calendar: true, timer: true, deviceInfo: true },
      placements: {},
    })

    expectValidLayout(layout)
    expect(layout.visibility.deviceInfo).toBe(true)
  })

  it('migrates old order-based layouts without letting hidden widgets take cells', () => {
    const order = ['tasks', 'notes', 'spotify', 'kanban', 'clock', 'weather', 'calendar', 'timer', 'stocks']
    const layout = loadStored(LAYOUT_KEY, {
      order,
      visibility: {
        tasks: false,
        notes: false,
        spotify: false,
        kanban: false,
        clock: true,
        weather: true,
        calendar: true,
        timer: true,
        stocks: true,
      },
    })

    expectValidLayout(layout)
    expect(visibleWidgets(layout)).toEqual(['clock', 'weather', 'calendar', 'timer', 'stocks'])
    expect(layout.placements.clock.row).toBe(1)
  })

  it('repairs overlapping placements in a stored layout and unblocks the editor', () => {
    const layout = loadStored(LAYOUT_KEY, {
      gridVersion: '2x3',
      rowCount: 3,
      visibility: { clock: true, weather: true, calendar: false, timer: true, tasks: true },
      placements: {
        clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
        weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
        timer: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
        tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
      },
    })

    expectValidLayout(layout)
    // timer comes first in widget order, so it keeps its cell and tasks moves.
    expect(layout.placements.timer).toMatchObject({ column: 1, row: 3 })
    expect(layout.visibility.tasks).toBe(true)
    expect(layout.placements.tasks).toMatchObject({ column: 2, row: 2 })

    expect(
      resolveWidgetDrop(layout, 'calendar', { column: 2, row: 3, columnSpan: 1, rowSpan: 1 }),
    ).not.toBeNull()
  })

  it('repairs overlapping preset layouts', () => {
    const layout = normalizeWidgetLayoutState({
      rowCount: 3,
      visibility: { clock: true, appleMusic: true, weather: true, timer: true },
      placements: {},
    })

    expectValidLayout(layout)
  })

  it('leaves a valid layout untouched', () => {
    const valid = normalizeWidgetLayoutState({
      rowCount: 4,
      visibility: { clock: true, weather: true, calendar: true, timer: true },
      placements: {
        clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
        weather: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
        calendar: { column: 1, row: 2, columnSpan: 1, rowSpan: 3 },
        timer: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 },
      },
    })

    expect(valid.rowCount).toBe(4)
    expect(valid.placements.weather).toEqual({ column: 2, row: 2, columnSpan: 1, rowSpan: 1 })
    expect(valid.placements.calendar).toEqual({ column: 1, row: 2, columnSpan: 1, rowSpan: 3 })
    expect(valid.placements.timer).toEqual({ column: 2, row: 4, columnSpan: 1, rowSpan: 1 })
    expect(normalizeWidgetLayoutState(valid)).toEqual(valid)
  })

  it('keeps placements of a current-version layout with a non-default row count', () => {
    const layout = loadStored(LAYOUT_KEY, {
      gridVersion: '2x3',
      rowCount: 5,
      visibility: { clock: true, weather: true, calendar: false, timer: false },
      placements: {
        clock: { column: 1, row: 4, columnSpan: 2, rowSpan: 2 },
        weather: { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
      },
    })

    expect(layout.rowCount).toBe(5)
    expect(layout.placements.clock).toEqual({ column: 1, row: 4, columnSpan: 2, rowSpan: 2 })
  })
})
