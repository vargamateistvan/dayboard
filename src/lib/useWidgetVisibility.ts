import { useCallback, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "./storage";

export const WIDGET_IDS = [
  "clock",
  "timezoneClock",
  "weather",
  "astronomy",
  "flights",
  "calendar",
  "timer",
  "tasks",
  "kanban",
  "notes",
  "spotify",
  "appleMusic",
  "applePodcast",
  "stocks",
  "currencies",
  "sports",
  "quote",
  "deviceInfo",
] as const;
export const WIDGET_GRID_COLUMNS = 2;
export const MIN_GRID_ROWS = 2;
export const MAX_GRID_ROWS = 6;
export const DEFAULT_GRID_ROWS = 3;

export type Widget = (typeof WIDGET_IDS)[number];
export type WidgetMoveDirection = "up" | "down" | "left" | "right";
export type WidgetGridColumn = 1 | 2;
export type WidgetGridRow = number;
export type WidgetColumnSpan = 1 | 2;
export type WidgetRowSpan = number;

type WidgetVisibility = Record<Widget, boolean>;

export interface WidgetPlacement {
  column: WidgetGridColumn;
  row: WidgetGridRow;
  columnSpan: WidgetColumnSpan;
  rowSpan: WidgetRowSpan;
}

type WidgetPlacements = Record<Widget, WidgetPlacement>;

export interface WidgetLayoutState {
  rowCount: number;
  visibility: WidgetVisibility;
  placements: WidgetPlacements;
}

const STORAGE_KEY = "dayboard_widget_layout";
const LEGACY_VISIBILITY_KEY = "dayboard_widget_visibility";
const CHANGE_EVENT = "dayboard:widget-layout-change";
// Version of the stored placement format. Layouts saved with another version
// get default placements. Bump it only when the format changes: it used to be
// derived from DEFAULT_GRID_ROWS, so changing that default reset every layout.
const GRID_VERSION = "2x3";

const DEFAULT_VISIBILITY: WidgetVisibility = {
  clock: true,
  timezoneClock: false,
  weather: true,
  astronomy: false,
  flights: false,
  calendar: true,
  timer: true,
  tasks: false,
  kanban: false,
  notes: false,
  spotify: false,
  appleMusic: false,
  applePodcast: false,
  stocks: false,
  currencies: false,
  sports: false,
  quote: false,
  deviceInfo: false,
};

const DEFAULT_PLACEMENTS: WidgetPlacements = {
  clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
  timezoneClock: { column: 2, row: 5, columnSpan: 1, rowSpan: 1 },
  weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
  astronomy: { column: 1, row: 6, columnSpan: 1, rowSpan: 1 },
  flights: { column: 1, row: 4, columnSpan: 1, rowSpan: 2 },
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
  sports: { column: 2, row: 5, columnSpan: 1, rowSpan: 1 },
  quote: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
  deviceInfo: { column: 2, row: 4, columnSpan: 1, rowSpan: 2 },
};

export const MIN_WIDGET_SIZE: Record<
  Widget,
  Pick<WidgetPlacement, "columnSpan" | "rowSpan">
> = {
  clock: { columnSpan: 1, rowSpan: 1 },
  timezoneClock: { columnSpan: 1, rowSpan: 1 },
  weather: { columnSpan: 1, rowSpan: 1 },
  astronomy: { columnSpan: 1, rowSpan: 1 },
  flights: { columnSpan: 1, rowSpan: 2 },
  calendar: { columnSpan: 1, rowSpan: 1 },
  timer: { columnSpan: 1, rowSpan: 1 },
  tasks: { columnSpan: 1, rowSpan: 1 },
  kanban: { columnSpan: 1, rowSpan: 1 },
  notes: { columnSpan: 1, rowSpan: 1 },
  spotify: { columnSpan: 1, rowSpan: 1 },
  appleMusic: { columnSpan: 1, rowSpan: 2 },
  applePodcast: { columnSpan: 1, rowSpan: 2 },
  stocks: { columnSpan: 1, rowSpan: 1 },
  currencies: { columnSpan: 1, rowSpan: 1 },
  sports: { columnSpan: 1, rowSpan: 1 },
  quote: { columnSpan: 1, rowSpan: 1 },
  deviceInfo: { columnSpan: 1, rowSpan: 2 },
};

const DEFAULT_LAYOUT: WidgetLayoutState = {
  rowCount: DEFAULT_GRID_ROWS,
  visibility: DEFAULT_VISIBILITY,
  placements: DEFAULT_PLACEMENTS,
};

let cachedRaw: string | null = null;
let cachedLayout: WidgetLayoutState = DEFAULT_LAYOUT;

function cloneDefaultLayout(): WidgetLayoutState {
  return {
    rowCount: DEFAULT_GRID_ROWS,
    visibility: { ...DEFAULT_VISIBILITY },
    placements: structuredClone(DEFAULT_PLACEMENTS),
  };
}

function clonePlacements(placements: WidgetPlacements): WidgetPlacements {
  return structuredClone(placements);
}

function isWidget(value: unknown): value is Widget {
  return typeof value === "string" && WIDGET_IDS.includes(value as Widget);
}

function clampColumn(value: unknown): WidgetGridColumn {
  return value === 2 ? 2 : 1;
}

function clampRow(value: unknown, rowCount: number): WidgetGridRow {
  const n = typeof value === "number" ? value : 1;
  return Math.min(Math.max(Math.round(n), 1), rowCount);
}

function clampColumnSpan(value: unknown): WidgetColumnSpan {
  return value === 2 ? 2 : 1;
}

function clampRowSpan(value: unknown, rowCount: number): WidgetRowSpan {
  const n = typeof value === "number" ? value : 1;
  return Math.min(Math.max(Math.round(n), 1), rowCount);
}

function clampRowCount(value: unknown): number {
  const n = typeof value === "number" ? value : DEFAULT_GRID_ROWS;
  return Math.min(Math.max(Math.round(n), MIN_GRID_ROWS), MAX_GRID_ROWS);
}

function normalizeVisibility(value: unknown): WidgetVisibility {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_VISIBILITY };
  }

  const candidate = value as Partial<Record<Widget, unknown>>;

  return WIDGET_IDS.reduce<WidgetVisibility>(
    (visibility, widget) => {
      visibility[widget] =
        typeof candidate[widget] === "boolean"
          ? (candidate[widget] as boolean)
          : DEFAULT_VISIBILITY[widget];
      return visibility;
    },
    { ...DEFAULT_VISIBILITY },
  );
}

function normalizePlacement(
  placement: unknown,
  fallback: WidgetPlacement,
  rowCount: number,
): WidgetPlacement {
  if (!placement || typeof placement !== "object") {
    return { ...fallback };
  }

  const candidate = placement as Partial<
    Record<keyof WidgetPlacement, unknown>
  >;
  const columnSpan = clampColumnSpan(candidate.columnSpan);
  const rowSpan = clampRowSpan(candidate.rowSpan, rowCount);
  const maxColumn = WIDGET_GRID_COLUMNS - columnSpan + 1;
  const maxRow = rowCount - rowSpan + 1;

  const column = Math.min(
    clampColumn(candidate.column),
    maxColumn,
  ) as WidgetGridColumn;
  const row = Math.min(clampRow(candidate.row, rowCount), maxRow);

  return { column, row, columnSpan, rowSpan };
}

function normalizePlacementForWidget(
  widget: Widget,
  placement: unknown,
  fallback: WidgetPlacement,
  rowCount: number,
): WidgetPlacement {
  const normalized = normalizePlacement(placement, fallback, rowCount);
  const minimum = MIN_WIDGET_SIZE[widget];
  const columnSpan = Math.max(
    normalized.columnSpan,
    minimum.columnSpan,
  ) as WidgetColumnSpan;
  const rowSpan = Math.max(normalized.rowSpan, minimum.rowSpan);
  const maxColumn = Math.max(1, WIDGET_GRID_COLUMNS - columnSpan + 1);
  const maxRow = Math.max(1, rowCount - rowSpan + 1);
  const column = Math.min(normalized.column, maxColumn) as WidgetGridColumn;
  const row = Math.min(normalized.row, maxRow);

  return { column, row, columnSpan, rowSpan };
}

function normalizePlacements(
  value: unknown,
  rowCount: number,
): WidgetPlacements {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<Record<Widget, unknown>>)
      : {};

  return WIDGET_IDS.reduce<WidgetPlacements>((placements, widget) => {
    placements[widget] = normalizePlacementForWidget(
      widget,
      candidate[widget],
      DEFAULT_PLACEMENTS[widget],
      rowCount,
    );
    return placements;
  }, clonePlacements(DEFAULT_PLACEMENTS));
}

function getOccupiedCells(placement: WidgetPlacement): string[] {
  const cells: string[] = [];

  for (let rowOffset = 0; rowOffset < placement.rowSpan; rowOffset += 1) {
    for (
      let columnOffset = 0;
      columnOffset < placement.columnSpan;
      columnOffset += 1
    ) {
      cells.push(
        `${placement.row + rowOffset}:${placement.column + columnOffset}`,
      );
    }
  }

  return cells;
}

function fitsGrid(placement: WidgetPlacement, rowCount: number): boolean {
  return (
    placement.column >= 1 &&
    placement.row >= 1 &&
    placement.column + placement.columnSpan - 1 <= WIDGET_GRID_COLUMNS &&
    placement.row + placement.rowSpan - 1 <= rowCount
  );
}

export function canPlaceWidget(
  placements: WidgetPlacements,
  visibility: WidgetVisibility,
  widget: Widget,
  nextPlacement: WidgetPlacement,
  rowCount: number,
): boolean {
  if (!fitsGrid(nextPlacement, rowCount)) {
    return false;
  }

  const occupiedCells = new Set(getOccupiedCells(nextPlacement));

  return WIDGET_IDS.every((currentWidget) => {
    if (currentWidget === widget) {
      return true;
    }

    if (!visibility[currentWidget]) {
      return true;
    }

    return getOccupiedCells(placements[currentWidget]).every(
      (cell) => !occupiedCells.has(cell),
    );
  });
}

export type WidgetPlacementPatch = Partial<Record<Widget, WidgetPlacement>>;

function placementsOverlap(left: WidgetPlacement, right: WidgetPlacement): boolean {
  return (
    left.column < right.column + right.columnSpan &&
    right.column < left.column + left.columnSpan &&
    left.row < right.row + right.rowSpan &&
    right.row < left.row + left.rowSpan
  );
}

function isLayoutValid(
  placements: WidgetPlacements,
  visibility: WidgetVisibility,
  rowCount: number,
): boolean {
  const visibleWidgets = WIDGET_IDS.filter((widget) => visibility[widget]);

  return visibleWidgets.every((widget, index) => {
    const placement = placements[widget];
    const minimum = MIN_WIDGET_SIZE[widget];

    return (
      fitsGrid(placement, rowCount) &&
      placement.columnSpan >= minimum.columnSpan &&
      placement.rowSpan >= minimum.rowSpan &&
      visibleWidgets
        .slice(index + 1)
        .every((other) => !placementsOverlap(placement, placements[other]))
    );
  });
}

/**
 * Resolves dropping `widget` at `target`. Returns the placements to apply, or
 * null when the drop is not possible. When the target overlaps exactly one
 * other widget and the dragged widget is already on the grid, the two widgets
 * swap positions.
 */
export function resolveWidgetDrop(
  layout: WidgetLayoutState,
  widget: Widget,
  target: WidgetPlacement,
): WidgetPlacementPatch | null {
  const { placements, visibility, rowCount } = layout;
  const nextVisibility = { ...visibility, [widget]: true };

  if (isLayoutValid({ ...placements, [widget]: target }, nextVisibility, rowCount)) {
    return { [widget]: target };
  }

  if (!visibility[widget]) {
    return null;
  }

  const overlapping = WIDGET_IDS.filter(
    (other) =>
      other !== widget &&
      visibility[other] &&
      placementsOverlap(target, placements[other]),
  );

  if (overlapping.length !== 1) {
    return null;
  }

  const [other] = overlapping;
  const origin = placements[widget];
  const swapped: WidgetPlacement = {
    ...placements[other],
    column: origin.column,
    row: origin.row,
  };
  const patch = { [widget]: target, [other]: swapped };

  return isLayoutValid({ ...placements, ...patch }, nextVisibility, rowCount)
    ? patch
    : null;
}

/** Inserts an empty row at `row`, shifting widgets at or below it down. */
export function insertGridRow(
  layout: WidgetLayoutState,
  row: number,
): WidgetLayoutState | null {
  if (layout.rowCount >= MAX_GRID_ROWS || row < 1 || row > layout.rowCount + 1) {
    return null;
  }

  const placements = clonePlacements(layout.placements);
  for (const widget of WIDGET_IDS) {
    if (placements[widget].row >= row) {
      placements[widget] = { ...placements[widget], row: placements[widget].row + 1 };
    }
  }

  return { ...layout, rowCount: layout.rowCount + 1, placements };
}

export interface GridRowRemoval {
  readonly layout: WidgetLayoutState;
  /** Visible widgets that lose a row. */
  readonly shrunk: Widget[];
  /** Visible widgets that no longer fit and go back to the palette. */
  readonly removed: Widget[];
}

/**
 * Deletes `row`. Widgets below move up, widgets spanning it lose a row, and
 * widgets that would drop below their minimum height are hidden.
 */
export function removeGridRow(
  layout: WidgetLayoutState,
  row: number,
): GridRowRemoval | null {
  if (layout.rowCount <= MIN_GRID_ROWS || row < 1 || row > layout.rowCount) {
    return null;
  }

  const placements = clonePlacements(layout.placements);
  const visibility = { ...layout.visibility };
  const shrunk: Widget[] = [];
  const removed: Widget[] = [];

  for (const widget of WIDGET_IDS) {
    const placement = placements[widget];
    const coversRow = placement.row <= row && row < placement.row + placement.rowSpan;

    if (placement.row > row) {
      placements[widget] = { ...placement, row: placement.row - 1 };
    } else if (coversRow && placement.rowSpan > MIN_WIDGET_SIZE[widget].rowSpan) {
      placements[widget] = { ...placement, rowSpan: placement.rowSpan - 1 };
      if (visibility[widget]) shrunk.push(widget);
    } else if (coversRow && visibility[widget]) {
      visibility[widget] = false;
      removed.push(widget);
    }
  }

  return {
    layout: {
      rowCount: layout.rowCount - 1,
      visibility,
      placements: normalizePlacements(placements, layout.rowCount - 1),
    },
    shrunk,
    removed,
  };
}

/**
 * The bottom-most row that can be deleted without hiding any widget,
 * preferring empty rows over rows where a tall widget would shrink.
 */
export function findRemovableRow(layout: WidgetLayoutState): number | null {
  const rows = Array.from({ length: layout.rowCount }, (_, index) => layout.rowCount - index);
  const removals = rows.map((row) => ({ row, removal: removeGridRow(layout, row) }));
  const empty = removals.find(
    ({ removal }) => removal && removal.removed.length === 0 && removal.shrunk.length === 0,
  );
  const shrinkOnly = removals.find(({ removal }) => removal && removal.removed.length === 0);
  return (empty ?? shrinkOnly)?.row ?? null;
}

export interface WidgetDropWithNewRows {
  readonly target: WidgetPlacement;
  readonly patch: WidgetPlacementPatch;
  readonly rowCount: number;
}

/**
 * Places `widget` at the bottom of the grid, adding as few rows as possible.
 * Tries each size in order, at `column` first and then the other columns.
 */
export function resolveWidgetDropWithNewRows(
  layout: WidgetLayoutState,
  widget: Widget,
  sizes: ReadonlyArray<Pick<WidgetPlacement, "columnSpan" | "rowSpan">>,
  column: number,
): WidgetDropWithNewRows | null {
  for (const size of sizes) {
    const maxColumn = WIDGET_GRID_COLUMNS - size.columnSpan + 1;
    const columns = [
      Math.min(Math.max(column, 1), maxColumn),
      ...Array.from({ length: maxColumn }, (_, index) => index + 1),
    ];

    for (let rowCount = layout.rowCount + 1; rowCount <= MAX_GRID_ROWS; rowCount += 1) {
      const row = Math.max(1, rowCount - size.rowSpan + 1);

      for (const candidateColumn of columns) {
        const target: WidgetPlacement = {
          column: candidateColumn as WidgetGridColumn,
          row,
          columnSpan: size.columnSpan,
          rowSpan: size.rowSpan,
        };
        const patch = resolveWidgetDrop({ ...layout, rowCount }, widget, target);
        if (patch) {
          return { target, patch, rowCount };
        }
      }
    }
  }

  return null;
}

function sortWidgetsByPlacement(placements: WidgetPlacements): Widget[] {
  return [...WIDGET_IDS].sort((left, right) => {
    const leftPlacement = placements[left];
    const rightPlacement = placements[right];

    if (leftPlacement.row !== rightPlacement.row) {
      return leftPlacement.row - rightPlacement.row;
    }

    if (leftPlacement.column !== rightPlacement.column) {
      return leftPlacement.column - rightPlacement.column;
    }

    return WIDGET_IDS.indexOf(left) - WIDGET_IDS.indexOf(right);
  });
}

function findAvailablePlacement(
  widget: Widget,
  currentLayout: WidgetLayoutState,
): WidgetPlacement | null {
  const preferredPlacement = currentLayout.placements[widget];
  const candidateSizes = Array.from(
    new Map(
      [
        { columnSpan: preferredPlacement.columnSpan, rowSpan: preferredPlacement.rowSpan },
        { columnSpan: DEFAULT_PLACEMENTS[widget].columnSpan, rowSpan: DEFAULT_PLACEMENTS[widget].rowSpan },
        { columnSpan: MIN_WIDGET_SIZE[widget].columnSpan, rowSpan: MIN_WIDGET_SIZE[widget].rowSpan },
      ].map((size) => [`${size.columnSpan}:${size.rowSpan}`, size]),
    ).values(),
  );

  for (const size of candidateSizes) {
    for (let row = 1; row <= currentLayout.rowCount; row += 1) {
      for (let column = 1; column <= WIDGET_GRID_COLUMNS; column += 1) {
        const nextPlacement = normalizePlacementForWidget(
          widget,
          { column, row, ...size },
          preferredPlacement,
          currentLayout.rowCount,
        );

        if (
          canPlaceWidget(
            currentLayout.placements,
            currentLayout.visibility,
            widget,
            nextPlacement,
            currentLayout.rowCount,
          )
        ) {
          return nextPlacement;
        }
      }
    }
  }

  return null;
}

/**
 * Makes a layout valid. Visible widgets are kept in grid order; one that falls
 * off the grid or overlaps a widget placed before it moves to the first free
 * spot, adding rows when needed, and is hidden only when the grid is full.
 * A valid layout is returned unchanged.
 */
function repairLayout(layout: WidgetLayoutState): WidgetLayoutState {
  if (isLayoutValid(layout.placements, layout.visibility, layout.rowCount)) {
    return layout;
  }

  const placements = clonePlacements(layout.placements);
  const kept = Object.fromEntries(
    WIDGET_IDS.map((widget) => [widget, false]),
  ) as WidgetVisibility;
  let rowCount = layout.rowCount;

  const visibleInGridOrder = sortWidgetsByPlacement(layout.placements).filter(
    (widget) => layout.visibility[widget],
  );

  for (const widget of visibleInGridOrder) {
    if (canPlaceWidget(placements, kept, widget, placements[widget], rowCount)) {
      kept[widget] = true;
      continue;
    }

    let spot = findAvailablePlacement(widget, { rowCount, visibility: kept, placements });
    while (!spot && rowCount < MAX_GRID_ROWS) {
      rowCount += 1;
      spot = findAvailablePlacement(widget, { rowCount, visibility: kept, placements });
    }

    if (spot) {
      placements[widget] = spot;
      kept[widget] = true;
    }
  }

  return { rowCount, visibility: kept, placements };
}

function normalizeLayout(value: unknown): WidgetLayoutState {
  if (!value || typeof value !== "object") {
    return cloneDefaultLayout();
  }

  const candidate = value as {
    rowCount?: unknown;
    visibility?: unknown;
    placements?: unknown;
  };

  const rowCount = clampRowCount(candidate.rowCount);

  return repairLayout({
    rowCount,
    visibility: normalizeVisibility(
      "visibility" in candidate ? candidate.visibility : candidate,
    ),
    placements: normalizePlacements(candidate.placements, rowCount),
  });
}

export function normalizeWidgetLayoutState(value: unknown): WidgetLayoutState {
  return normalizeLayout(value);
}

function migrateLegacyLayout(value: {
  visibility: WidgetVisibility;
  order?: unknown;
  columnSpans?: unknown;
}): WidgetLayoutState {
  const rowCount = DEFAULT_GRID_ROWS;
  const visibility = value.visibility;
  const order = Array.isArray(value.order)
    ? value.order.filter(isWidget)
    : [...WIDGET_IDS];
  const uniqueOrder: Widget[] = [];

  order.forEach((widget) => {
    if (!uniqueOrder.includes(widget)) {
      uniqueOrder.push(widget);
    }
  });
  WIDGET_IDS.forEach((widget) => {
    if (!uniqueOrder.includes(widget)) {
      uniqueOrder.push(widget);
    }
  });

  const columnSpans =
    value.columnSpans && typeof value.columnSpans === "object"
      ? (value.columnSpans as Partial<Record<Widget, unknown>>)
      : {};

  const nextPlacements = clonePlacements(DEFAULT_PLACEMENTS);
  const occupied = new Set<string>();

  // Hidden widgets keep their defaults; letting them claim cells first would
  // push visible widgets out of the grid.
  uniqueOrder.filter((widget) => visibility[widget]).forEach((widget) => {
    const preferredColumnSpan =
      columnSpans[widget] === 2 ? 2 : DEFAULT_PLACEMENTS[widget].columnSpan;
    const candidates: Array<Pick<WidgetPlacement, "columnSpan" | "rowSpan">> = [
      { columnSpan: preferredColumnSpan, rowSpan: 1 },
      { columnSpan: 1, rowSpan: 1 },
    ];

    for (const size of candidates) {
      let placed = false;

      for (let row = 1; row <= rowCount && !placed; row += 1) {
        for (
          let column = 1;
          column <= WIDGET_GRID_COLUMNS && !placed;
          column += 1
        ) {
          const placement = normalizePlacementForWidget(
            widget,
            { column, row, ...size },
            DEFAULT_PLACEMENTS[widget],
            rowCount,
          );

          const cells = getOccupiedCells(placement);
          if (cells.every((cell) => !occupied.has(cell))) {
            nextPlacements[widget] = placement;
            cells.forEach((cell) => occupied.add(cell));
            placed = true;
          }
        }
      }

      if (placed) {
        break;
      }
    }
  });

  return repairLayout({
    rowCount,
    visibility,
    placements: nextPlacements,
  });
}

function readRawLayout(): string | null {
  const raw = readStorage(STORAGE_KEY);
  if (raw !== null) {
    return `layout:${raw}`;
  }

  const legacyRaw = readStorage(LEGACY_VISIBILITY_KEY);
  if (legacyRaw !== null) {
    return `legacy:${legacyRaw}`;
  }

  return null;
}

function parseStoredLayout(raw: string | null): WidgetLayoutState {
  if (!raw) {
    return cloneDefaultLayout();
  }

  const separatorIndex = raw.indexOf(":");
  if (separatorIndex === -1) {
    return cloneDefaultLayout();
  }

  const prefix = raw.slice(0, separatorIndex);
  const serialized = raw.slice(separatorIndex + 1);

  try {
    const parsed = JSON.parse(serialized) as {
      gridVersion?: unknown;
      rowCount?: unknown;
      visibility?: unknown;
      placements?: unknown;
      order?: unknown;
      columnSpans?: unknown;
    };

    if (prefix === "legacy") {
      return repairLayout({
        rowCount: DEFAULT_GRID_ROWS,
        visibility: normalizeVisibility(parsed),
        placements: clonePlacements(DEFAULT_PLACEMENTS),
      });
    }

    // Reset placements to defaults when the column count changed (modern format only)
    if ("placements" in parsed && parsed.gridVersion !== GRID_VERSION) {
      return repairLayout({
        rowCount: DEFAULT_GRID_ROWS,
        visibility: normalizeVisibility(parsed.visibility ?? parsed),
        placements: clonePlacements(DEFAULT_PLACEMENTS),
      });
    }

    if (
      !("placements" in parsed) &&
      ("order" in parsed || "columnSpans" in parsed)
    ) {
      return migrateLegacyLayout({
        visibility: normalizeVisibility(parsed.visibility),
        order: parsed.order,
        columnSpans: parsed.columnSpans,
      });
    }

    return normalizeLayout(parsed);
  } catch {
    return cloneDefaultLayout();
  }
}

function readLayout(): WidgetLayoutState {
  const raw = readRawLayout();
  if (raw === cachedRaw) {
    return cachedLayout;
  }

  cachedRaw = raw;
  cachedLayout = parseStoredLayout(raw);
  return cachedLayout;
}

function writeLayout(nextLayout: WidgetLayoutState) {
  const normalizedLayout = normalizeLayout(nextLayout);
  const raw = JSON.stringify({
    gridVersion: GRID_VERSION,
    ...normalizedLayout,
  });

  const saved =
    writeStorage(STORAGE_KEY, raw) &&
    writeStorage(
      LEGACY_VISIBILITY_KEY,
      JSON.stringify(normalizedLayout.visibility),
    );

  // When the write fails, key the cache to what is actually stored so the
  // edit stays in memory for this session instead of silently reverting.
  cachedRaw = saved ? `layout:${raw}` : readRawLayout();
  cachedLayout = normalizedLayout;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (
      event.storageArea === localStorage &&
      (event.key === STORAGE_KEY || event.key === LEGACY_VISIBILITY_KEY)
    ) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useWidgetVisibility() {
  const layout = useSyncExternalStore(
    subscribe,
    readLayout,
    cloneDefaultLayout,
  );
  const order = sortWidgetsByPlacement(layout.placements);
  const rowCount = layout.rowCount;

  const toggleWidget = useCallback((widget: Widget, visible?: boolean) => {
    const currentLayout = readLayout();
    const nextVisible = visible ?? !currentLayout.visibility[widget];

    if (!nextVisible) {
      writeLayout({
        ...currentLayout,
        visibility: {
          ...currentLayout.visibility,
          [widget]: false,
        },
      });
      return;
    }

    const nextPlacement = findAvailablePlacement(widget, currentLayout);
    if (!nextPlacement) {
      return;
    }

    writeLayout({
      ...currentLayout,
      visibility: {
        ...currentLayout.visibility,
        [widget]: true,
      },
      placements: {
        ...currentLayout.placements,
        [widget]: nextPlacement,
      },
    });
  }, []);

  const moveWidget = useCallback(
    (widget: Widget, direction: WidgetMoveDirection) => {
      const currentLayout = readLayout();
      const currentPlacement = currentLayout.placements[widget];
      let nextColumn = currentPlacement.column;
      let nextRow = currentPlacement.row;

      if (direction === "left") {
        nextColumn -= 1;
      } else if (direction === "right") {
        nextColumn += 1;
      }

      if (direction === "up") {
        nextRow -= 1;
      } else if (direction === "down") {
        nextRow += 1;
      }

      const nextPlacement = normalizePlacementForWidget(
        widget,
        {
          ...currentPlacement,
          column: nextColumn,
          row: nextRow,
        },
        currentPlacement,
        currentLayout.rowCount,
      );

      if (
        !canPlaceWidget(
          currentLayout.placements,
          currentLayout.visibility,
          widget,
          nextPlacement,
          currentLayout.rowCount,
        )
      ) {
        return;
      }

      writeLayout({
        ...currentLayout,
        placements: {
          ...currentLayout.placements,
          [widget]: nextPlacement,
        },
      });
    },
    [],
  );

  const setWidgetPlacement = useCallback(
    (widget: Widget, nextPlacement: WidgetPlacement) => {
      const currentLayout = readLayout();
      const normalizedPlacement = normalizePlacementForWidget(
        widget,
        nextPlacement,
        currentLayout.placements[widget],
        currentLayout.rowCount,
      );

      if (
        !canPlaceWidget(
          currentLayout.placements,
          currentLayout.visibility,
          widget,
          normalizedPlacement,
          currentLayout.rowCount,
        )
      ) {
        return;
      }

      writeLayout({
        ...currentLayout,
        placements: {
          ...currentLayout.placements,
          [widget]: normalizedPlacement,
        },
      });
    },
    [],
  );

  // Applies several placements atomically and shows every placed widget.
  // Pass `rowCount` to grow the grid in the same update.
  const placeWidgets = useCallback(
    (patch: WidgetPlacementPatch, options?: { rowCount?: number }) => {
      const currentLayout = readLayout();
      const rowCount = Math.max(
        currentLayout.rowCount,
        clampRowCount(options?.rowCount ?? currentLayout.rowCount),
      );
      const nextPlacements = { ...currentLayout.placements };
      const nextVisibility = { ...currentLayout.visibility };

      for (const widget of Object.keys(patch) as Widget[]) {
        nextPlacements[widget] = normalizePlacementForWidget(
          widget,
          patch[widget],
          currentLayout.placements[widget],
          rowCount,
        );
        nextVisibility[widget] = true;
      }

      if (!isLayoutValid(nextPlacements, nextVisibility, rowCount)) {
        return;
      }

      writeLayout({
        rowCount,
        visibility: nextVisibility,
        placements: nextPlacements,
      });
    },
    [],
  );

  const insertRow = useCallback((row: number) => {
    const nextLayout = insertGridRow(readLayout(), row);
    if (nextLayout) writeLayout(nextLayout);
  }, []);

  const deleteRow = useCallback((row: number) => {
    const removal = removeGridRow(readLayout(), row);
    if (removal) writeLayout(removal.layout);
  }, []);

  return {
    visibility: layout.visibility,
    placements: layout.placements,
    rowCount,
    order,
    toggleWidget,
    moveWidget,
    setWidgetPlacement,
    placeWidgets,
    insertRow,
    deleteRow,
  };
}

export function loadWidgetLayoutState(): WidgetLayoutState {
  return structuredClone(readLayout());
}

export function saveWidgetLayoutState(layout: WidgetLayoutState): void {
  writeLayout(layout);
}
