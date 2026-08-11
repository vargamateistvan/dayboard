import { useCallback, useSyncExternalStore } from "react";

export const WIDGET_IDS = [
  "clock",
  "timezoneClock",
  "weather",
  "flights",
  "calendar",
  "timer",
  "tasks",
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
const GRID_VERSION = `${WIDGET_GRID_COLUMNS}x${DEFAULT_GRID_ROWS}`;

const DEFAULT_VISIBILITY: WidgetVisibility = {
  clock: true,
  timezoneClock: false,
  weather: true,
  flights: false,
  calendar: true,
  timer: true,
  tasks: false,
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
  flights: { column: 1, row: 4, columnSpan: 1, rowSpan: 2 },
  calendar: { column: 2, row: 2, columnSpan: 1, rowSpan: 2 },
  timer: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
  tasks: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
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
  flights: { columnSpan: 1, rowSpan: 2 },
  calendar: { columnSpan: 1, rowSpan: 1 },
  timer: { columnSpan: 1, rowSpan: 1 },
  tasks: { columnSpan: 1, rowSpan: 1 },
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

  return {
    rowCount,
    visibility: normalizeVisibility(
      "visibility" in candidate ? candidate.visibility : candidate,
    ),
    placements: normalizePlacements(candidate.placements, rowCount),
  };
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

  uniqueOrder.forEach((widget) => {
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

  return {
    rowCount,
    visibility,
    placements: nextPlacements,
  };
}

function readRawLayout(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    return `layout:${raw}`;
  }

  const legacyRaw = localStorage.getItem(LEGACY_VISIBILITY_KEY);
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
      return {
        rowCount: DEFAULT_GRID_ROWS,
        visibility: normalizeVisibility(parsed),
        placements: clonePlacements(DEFAULT_PLACEMENTS),
      };
    }

    // Reset placements to defaults when the column count changed (modern format only)
    if ("placements" in parsed && parsed.gridVersion !== GRID_VERSION) {
      return {
        rowCount: DEFAULT_GRID_ROWS,
        visibility: normalizeVisibility(parsed.visibility ?? parsed),
        placements: clonePlacements(DEFAULT_PLACEMENTS),
      };
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

  cachedRaw = `layout:${raw}`;
  cachedLayout = normalizedLayout;

  localStorage.setItem(STORAGE_KEY, raw);
  localStorage.setItem(
    LEGACY_VISIBILITY_KEY,
    JSON.stringify(normalizedLayout.visibility),
  );
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
    writeLayout({
      ...currentLayout,
      visibility: {
        ...currentLayout.visibility,
        [widget]: visible ?? !currentLayout.visibility[widget],
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

  const addRow = useCallback(() => {
    const currentLayout = readLayout();
    if (currentLayout.rowCount >= MAX_GRID_ROWS) return;
    writeLayout({ ...currentLayout, rowCount: currentLayout.rowCount + 1 });
  }, []);

  const removeRow = useCallback(() => {
    const currentLayout = readLayout();
    if (currentLayout.rowCount <= MIN_GRID_ROWS) return;
    const newRowCount = currentLayout.rowCount - 1;
    // Push any widgets that now exceed the grid back to the last valid row
    const nextPlacements = { ...currentLayout.placements };
    for (const widget of WIDGET_IDS) {
      if (!currentLayout.visibility[widget]) continue;
      const p = nextPlacements[widget];
      const maxRow = newRowCount - p.rowSpan + 1;
      if (p.row > maxRow) {
        nextPlacements[widget] = { ...p, row: Math.max(1, maxRow) };
      }
      // Clamp rowSpan so the widget fits within the new row count
      const maxSpan = newRowCount - nextPlacements[widget].row + 1;
      if (nextPlacements[widget].rowSpan > maxSpan) {
        nextPlacements[widget] = {
          ...nextPlacements[widget],
          rowSpan: Math.max(1, maxSpan),
        };
      }

    }
    writeLayout({
      ...currentLayout,
      rowCount: newRowCount,
      placements: nextPlacements,
    });
  }, []);

  return {
    visibility: layout.visibility,
    placements: layout.placements,
    rowCount,
    order,
    toggleWidget,
    moveWidget,
    setWidgetPlacement,
    addRow,
    removeRow,
  };
}

export function loadWidgetLayoutState(): WidgetLayoutState {
  return structuredClone(readLayout());
}

export function saveWidgetLayoutState(layout: WidgetLayoutState): void {
  writeLayout(layout);
}
