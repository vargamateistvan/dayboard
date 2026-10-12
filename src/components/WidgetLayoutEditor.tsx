import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import {
  WIDGET_GRID_COLUMNS,
  MIN_GRID_ROWS,
  MAX_GRID_ROWS,
  MIN_WIDGET_SIZE,
  canPlaceWidget,
  findRemovableRow,
  removeGridRow,
  resolveWidgetDrop,
  resolveWidgetDropWithNewRows,
  type Widget,
  type WidgetColumnSpan,
  type WidgetGridColumn,
  type WidgetLayoutState,
  type WidgetPlacement,
  type WidgetPlacementPatch,
} from "../lib/useWidgetVisibility";
import { getWidgetLabel } from "../lib/widgetMetadata";
import styles from "./WidgetLayoutEditor.module.css";

interface WidgetLayoutEditorProps {
  readonly order: Widget[];
  readonly visibility: Record<Widget, boolean>;
  readonly placements: Record<Widget, WidgetPlacement>;
  readonly rowCount: number;
  readonly onPlaceWidgets: (patch: WidgetPlacementPatch, options?: { rowCount?: number }) => void;
  readonly onToggleWidget: (widget: Widget, visible?: boolean) => void;
  readonly onInsertRow: (row: number) => void;
  readonly onDeleteRow: (row: number) => void;
}

const WIDGET_CHIP_GROUPS: ReadonlyArray<{
  id: "core" | "productivity" | "media" | "finance" | "sports";
  label: string;
  widgets: readonly Widget[];
}> = [
  {
    id: "core",
    label: "Core",
    widgets: ["clock", "timezoneClock", "weather", "astronomy", "flights", "calendar", "deviceInfo"],
  },
  {
    id: "productivity",
    label: "Productivity",
    widgets: ["timer", "tasks", "kanban", "notes", "quote"],
  },
  {
    id: "media",
    label: "Media",
    widgets: ["spotify", "appleMusic", "applePodcast"],
  },
  {
    id: "finance",
    label: "Finance",
    widgets: ["stocks", "currencies"],
  },
  {
    id: "sports",
    label: "Sports",
    widgets: ["sports"],
  },
] as const;

// Mouse and pen drags start after a short move; touch drags start after a
// press-and-hold so swiping over the editor still scrolls the dialog.
const DRAG_THRESHOLD_PX = 4;
const TOUCH_SLOP_PX = 8;
const TOUCH_HOLD_MS = 250;

const ARROW_DELTAS: Record<string, { column: number; row: number }> = {
  ArrowLeft: { column: -1, row: 0 },
  ArrowRight: { column: 1, row: 0 },
  ArrowUp: { column: 0, row: -1 },
  ArrowDown: { column: 0, row: 1 },
};

type DragSource = "palette" | "grid";
type WidgetSize = Pick<WidgetPlacement, "columnSpan" | "rowSpan">;

interface DragState {
  readonly widget: Widget;
  readonly source: DragSource;
  readonly x: number;
  readonly y: number;
  readonly target: WidgetPlacement | null;
  readonly patch: WidgetPlacementPatch | null;
  /** Set when the drop adds rows below the grid. */
  readonly newRowCount: number | null;
  readonly overPalette: boolean;
  readonly overNewRow: boolean;
}

interface RowPreview {
  readonly kind: "insert" | "delete";
  readonly row: number;
}

type DropResult = Pick<DragState, "target" | "patch" | "newRowCount" | "overPalette" | "overNewRow">;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function isPointInside(rect: DOMRect | undefined, x: number, y: number) {
  return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function uniqueSizes(sizes: WidgetSize[]): WidgetSize[] {
  return Array.from(
    new Map(sizes.map((size) => [`${size.columnSpan}:${size.rowSpan}`, size])).values(),
  );
}

function describePlacement(widget: Widget, placement: WidgetPlacement) {
  return `${getWidgetLabel(widget)}: column ${placement.column}, row ${placement.row}, ${placement.columnSpan} by ${placement.rowSpan}`;
}

function listLabels(widgets: readonly Widget[]) {
  return widgets.map(getWidgetLabel).join(", ");
}

export function WidgetLayoutEditor({
  order,
  visibility,
  placements,
  rowCount,
  onPlaceWidgets,
  onToggleWidget,
  onInsertRow,
  onDeleteRow,
}: WidgetLayoutEditorProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resizingWidget, setResizingWidget] = useState<Widget | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rowPreview, setRowPreview] = useState<RowPreview | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const newRowZoneRef = useRef<HTMLDivElement | null>(null);
  const endSessionRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const keyboardHintId = useId();

  // Window listeners outlive a render, so they read the latest props from here.
  const latestRef = useRef({ placements, visibility, rowCount, onPlaceWidgets, onToggleWidget });
  useEffect(() => {
    latestRef.current = { placements, visibility, rowCount, onPlaceWidgets, onToggleWidget };
  });

  useEffect(() => () => endSessionRef.current?.(), []);

  const visibleWidgets = order.filter((w) => visibility[w]);
  const hiddenWidgets = order.filter((w) => !visibility[w]);
  const allWidgets = [...visibleWidgets, ...hiddenWidgets];
  const groupedWidgets = WIDGET_CHIP_GROUPS
    .map((group) => ({
      ...group,
      widgets: allWidgets.filter((widget) => group.widgets.includes(widget)),
    }))
    .filter((group) => group.widgets.length > 0);

  const getLayout = (): WidgetLayoutState => {
    const { placements: p, visibility: v, rowCount: r } = latestRef.current;
    return { placements: p, visibility: v, rowCount: r };
  };

  const getGridMetrics = () => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const rows = latestRef.current.rowCount;
    return { rect, cellWidth: rect.width / WIDGET_GRID_COLUMNS, cellHeight: rect.height / rows };
  };

  const getCellOffsetWithin = (widget: Widget, x: number, y: number) => {
    const metrics = getGridMetrics();
    const placement = latestRef.current.placements[widget];
    if (!metrics) return { column: 0, row: 0 };
    const column = Math.floor((x - metrics.rect.left) / metrics.cellWidth) + 1;
    const row = Math.floor((y - metrics.rect.top) / metrics.cellHeight) + 1;
    return {
      column: clamp(column - placement.column, 0, placement.columnSpan - 1),
      row: clamp(row - placement.row, 0, placement.rowSpan - 1),
    };
  };

  const evaluateDrop = (
    widget: Widget,
    source: DragSource,
    grabOffset: { column: number; row: number },
    x: number,
    y: number,
  ): DropResult => {
    const empty = { target: null, patch: null, newRowCount: null, overPalette: false, overNewRow: false };
    const metrics = getGridMetrics();
    const layout = getLayout();
    const current = layout.placements[widget];
    const sizes = source === "grid"
      ? [current]
      : uniqueSizes([current, MIN_WIDGET_SIZE[widget]]);

    if (isPointInside(paletteRef.current?.getBoundingClientRect(), x, y)) {
      return { ...empty, overPalette: true };
    }

    if (isPointInside(newRowZoneRef.current?.getBoundingClientRect(), x, y)) {
      const column = metrics
        ? Math.floor((x - metrics.rect.left) / metrics.cellWidth) + 1
        : 1;
      const drop = resolveWidgetDropWithNewRows(layout, widget, sizes, column);
      return drop
        ? { ...empty, overNewRow: true, target: drop.target, patch: drop.patch, newRowCount: drop.rowCount }
        : { ...empty, overNewRow: true };
    }

    if (!metrics || !isPointInside(metrics.rect, x, y)) {
      return empty;
    }

    const pointerColumn = Math.floor((x - metrics.rect.left) / metrics.cellWidth) + 1;
    const pointerRow = Math.floor((y - metrics.rect.top) / metrics.cellHeight) + 1;
    let fallback: WidgetPlacement | null = null;

    for (const size of sizes) {
      const target: WidgetPlacement = {
        column: clamp(
          pointerColumn - grabOffset.column,
          1,
          WIDGET_GRID_COLUMNS - size.columnSpan + 1,
        ) as WidgetGridColumn,
        row: clamp(pointerRow - grabOffset.row, 1, layout.rowCount - size.rowSpan + 1),
        columnSpan: size.columnSpan,
        rowSpan: size.rowSpan,
      };
      const patch = resolveWidgetDrop(layout, widget, target);
      if (patch) return { ...empty, target, patch };
      fallback ??= target;
    }

    return { ...empty, target: fallback };
  };

  const startSession = (
    e: ReactPointerEvent,
    handlers: {
      readonly activateImmediately: boolean;
      readonly onActivate: (x: number, y: number) => void;
      readonly onMove: (x: number, y: number) => void;
      readonly onCommit: (x: number, y: number) => void;
      readonly onCancel: () => void;
    },
  ) => {
    endSessionRef.current?.();

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType === "touch";
    let active = false;
    let holdTimer: number | null = null;

    const activate = (x: number, y: number) => {
      active = true;
      suppressClickRef.current = true;
      handlers.onActivate(x, y);
    };

    const end = () => {
      if (holdTimer !== null) window.clearTimeout(holdTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown, true);
      endSessionRef.current = null;
      // The click that follows a drag must not toggle a palette chip.
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) {
        handlers.onMove(ev.clientX, ev.clientY);
        return;
      }
      const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (isTouch) {
        if (distance > TOUCH_SLOP_PX) end();
      } else if (distance >= DRAG_THRESHOLD_PX) {
        activate(ev.clientX, ev.clientY);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) handlers.onCommit(ev.clientX, ev.clientY);
      end();
    };

    const onPointerCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (active) handlers.onCancel();
      end();
    };

    // Stops the page from scrolling under an active touch drag.
    const onTouchMove = (ev: TouchEvent) => {
      if (active) ev.preventDefault();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || !active) return;
      ev.preventDefault();
      ev.stopPropagation();
      handlers.onCancel();
      end();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown, true);
    endSessionRef.current = () => {
      if (active) handlers.onCancel();
      end();
    };

    if (handlers.activateImmediately) {
      activate(startX, startY);
    } else if (isTouch) {
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        navigator.vibrate?.(10);
        activate(startX, startY);
      }, TOUCH_HOLD_MS);
    }
  };

  const handleDragPointerDown = (widget: Widget, source: DragSource) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const grabOffset = source === "grid"
      ? getCellOffsetWithin(widget, e.clientX, e.clientY)
      : { column: 0, row: 0 };
    const update = (x: number, y: number) =>
      setDrag({ widget, source, x, y, ...evaluateDrop(widget, source, grabOffset, x, y) });

    startSession(e, {
      activateImmediately: false,
      onActivate: update,
      onMove: update,
      onCommit: (x, y) => {
        const result = evaluateDrop(widget, source, grabOffset, x, y);
        const { onPlaceWidgets: place, onToggleWidget: toggle } = latestRef.current;
        if (result.patch && result.target) {
          place(result.patch, result.newRowCount ? { rowCount: result.newRowCount } : undefined);
          const swappedWith = (Object.keys(result.patch) as Widget[]).find((w) => w !== widget);
          let message = `Moved ${describePlacement(widget, result.target)}`;
          if (swappedWith) {
            message = `Swapped ${getWidgetLabel(widget)} with ${getWidgetLabel(swappedWith)}`;
          } else if (result.newRowCount) {
            message = `Added a row and placed ${describePlacement(widget, result.target)}`;
          }
          setAnnouncement(message);
        } else if (source === "grid" && result.overPalette) {
          toggle(widget, false);
          setAnnouncement(`Removed ${getWidgetLabel(widget)} from dashboard`);
        }
        setDrag(null);
      },
      onCancel: () => {
        setDrag(null);
        setAnnouncement("Move cancelled");
      },
    });
  };

  const findLargestFit = (widget: Widget, desired: WidgetSize): WidgetPlacement | null => {
    const layout = getLayout();
    const placement = layout.placements[widget];
    const minimum = MIN_WIDGET_SIZE[widget];
    for (let rowSpan = desired.rowSpan; rowSpan >= minimum.rowSpan; rowSpan -= 1) {
      for (let columnSpan = desired.columnSpan; columnSpan >= minimum.columnSpan; columnSpan -= 1) {
        const candidate = { ...placement, columnSpan: columnSpan as WidgetColumnSpan, rowSpan };
        if (canPlaceWidget(layout.placements, layout.visibility, widget, candidate, layout.rowCount)) {
          return candidate;
        }
      }
    }
    return null;
  };

  const handleResizePointerDown = (widget: Widget) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const metrics = getGridMetrics();
    if (!metrics) return;
    const start = latestRef.current.placements[widget];

    startSession(e, {
      activateImmediately: true,
      onActivate: () => setResizingWidget(widget),
      onMove: (x, y) => {
        const { placements: current, rowCount: rows } = latestRef.current;
        const placement = current[widget];
        const desired = {
          columnSpan: clamp(
            start.columnSpan + Math.round((x - e.clientX) / metrics.cellWidth),
            1,
            WIDGET_GRID_COLUMNS - placement.column + 1,
          ) as WidgetColumnSpan,
          rowSpan: clamp(
            start.rowSpan + Math.round((y - e.clientY) / metrics.cellHeight),
            1,
            rows - placement.row + 1,
          ),
        };
        const next = findLargestFit(widget, desired);
        if (next && (next.columnSpan !== placement.columnSpan || next.rowSpan !== placement.rowSpan)) {
          latestRef.current.onPlaceWidgets({ [widget]: next });
        }
      },
      onCommit: () => {
        setResizingWidget(null);
        setAnnouncement(`Resized ${describePlacement(widget, latestRef.current.placements[widget])}`);
      },
      onCancel: () => {
        latestRef.current.onPlaceWidgets({ [widget]: start });
        setResizingWidget(null);
        setAnnouncement("Resize cancelled");
      },
    });
  };

  const handleWidgetKeyDown = (widget: Widget) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const label = getWidgetLabel(widget);

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onToggleWidget(widget, false);
      setAnnouncement(`Removed ${label} from dashboard`);
      return;
    }

    const delta = ARROW_DELTAS[e.key];
    if (!delta) return;
    e.preventDefault();
    const layout: WidgetLayoutState = { placements, visibility, rowCount };
    const placement = placements[widget];

    if (e.shiftKey) {
      const next = {
        ...placement,
        columnSpan: (placement.columnSpan + delta.column) as WidgetColumnSpan,
        rowSpan: placement.rowSpan + delta.row,
      };
      const minimum = MIN_WIDGET_SIZE[widget];
      const fits =
        next.columnSpan >= minimum.columnSpan &&
        next.rowSpan >= minimum.rowSpan &&
        canPlaceWidget(placements, visibility, widget, next, rowCount);
      if (fits) {
        onPlaceWidgets({ [widget]: next });
        setAnnouncement(`Resized ${describePlacement(widget, next)}`);
      } else {
        setAnnouncement(`${label} can't be resized that way`);
      }
      return;
    }

    const target = {
      ...placement,
      column: (placement.column + delta.column) as WidgetGridColumn,
      row: placement.row + delta.row,
    };
    const patch = resolveWidgetDrop(layout, widget, target);
    if (!patch) {
      setAnnouncement(`${label} can't move that way`);
      return;
    }
    onPlaceWidgets(patch);
    const swappedWith = (Object.keys(patch) as Widget[]).find((w) => w !== widget);
    setAnnouncement(
      swappedWith
        ? `Swapped ${label} with ${getWidgetLabel(swappedWith)}`
        : `Moved ${describePlacement(widget, target)}`,
    );
  };

  const handleAddWidget = (widget: Widget) => {
    const currentPlacement = placements[widget];
    const layout: WidgetLayoutState = { placements, visibility, rowCount };
    const sizes = uniqueSizes([
      currentPlacement,
      MIN_WIDGET_SIZE[widget],
      { columnSpan: 1, rowSpan: 1 },
    ]);

    for (const size of sizes) {
      for (let row = 1; row <= rowCount; row += 1) {
        for (let column = 1; column <= WIDGET_GRID_COLUMNS; column += 1) {
          const candidate = { column: column as WidgetGridColumn, row, ...size };
          if (resolveWidgetDrop(layout, widget, candidate)) {
            onPlaceWidgets({ [widget]: candidate });
            setAnnouncement(`Added ${describePlacement(widget, candidate)}`);
            return;
          }
        }
      }
    }

    const drop = resolveWidgetDropWithNewRows(layout, widget, sizes, 1);
    if (drop) {
      onPlaceWidgets(drop.patch, { rowCount: drop.rowCount });
      setAnnouncement(`Added a row and placed ${describePlacement(widget, drop.target)}`);
      return;
    }

    setAnnouncement(`No room for ${getWidgetLabel(widget)}. Remove a widget first.`);
  };

  const layoutNow: WidgetLayoutState = { placements, visibility, rowCount };
  const removableRow = findRemovableRow(layoutNow);
  const rowRemovals = Array.from({ length: rowCount }, (_, index) => removeGridRow(layoutNow, index + 1));
  const deletePreview = rowPreview?.kind === "delete" ? rowRemovals[rowPreview.row - 1] : null;

  const handleInsertRow = (row: number) => {
    onInsertRow(row);
    setRowPreview(null);
    setAnnouncement(row > rowCount ? `Added row ${row}` : `Inserted a row above row ${row}`);
  };

  const handleDeleteRow = (row: number) => {
    const removal = rowRemovals[row - 1];
    if (!removal) return;
    onDeleteRow(row);
    setRowPreview(null);
    setAnnouncement(
      removal.removed.length > 0
        ? `Deleted row ${row} and removed ${listLabels(removal.removed)} from dashboard`
        : `Deleted row ${row}`,
    );
  };

  const describeRowDeletion = (row: number) => {
    const removal = rowRemovals[row - 1];
    if (!removal) return `The grid needs at least ${MIN_GRID_ROWS} rows`;
    const parts = [`Delete row ${row}`];
    if (removal.shrunk.length > 0) parts.push(`shrinks ${listLabels(removal.shrunk)}`);
    if (removal.removed.length > 0) parts.push(`removes ${listLabels(removal.removed)}`);
    return parts.join(" — ");
  };

  const previewRowHandlers = (preview: RowPreview | null) =>
    preview
      ? {
          onMouseEnter: () => setRowPreview(preview),
          onMouseLeave: () => setRowPreview(null),
          onFocus: () => setRowPreview(preview),
          onBlur: () => setRowPreview(null),
        }
      : {};

  let removeRowTitle = `The grid needs at least ${MIN_GRID_ROWS} rows`;
  if (rowCount > MIN_GRID_ROWS) {
    removeRowTitle = removableRow === null
      ? "Every row has a widget that would be removed — use a row's delete button instead"
      : describeRowDeletion(removableRow);
  }

  const handlePaletteWidgetClick = (widget: Widget) => {
    if (suppressClickRef.current) return;
    if (visibility[widget]) {
      onToggleWidget(widget, false);
      setAnnouncement(`Removed ${getWidgetLabel(widget)} from dashboard`);
      return;
    }
    handleAddWidget(widget);
  };

  const swapPartner = drag?.patch
    ? (Object.keys(drag.patch) as Widget[]).find((w) => w !== drag.widget) ?? null
    : null;
  const isRemovingByDrop = drag?.source === "grid" && drag.overPalette;
  const showNewRowZone = !!drag && rowCount < MAX_GRID_ROWS;

  let previewClass = styles.dropPreviewInvalid;
  let previewText = "No room here";
  if (drag?.patch) {
    previewClass = swapPartner ? styles.dropPreviewSwap : styles.dropPreviewValid;
    previewText = swapPartner ? `Swap with ${getWidgetLabel(swapPartner)}` : "Drop here";
  }

  let newRowZoneText = "No room in a new row";
  if (drag?.patch && drag.overNewRow) {
    newRowZoneText = `Release to add a row for ${getWidgetLabel(drag.widget)}`;
  } else if (!drag?.overNewRow) {
    newRowZoneText = "Drop here to add a row";
  }

  let paletteHint = "Click to add or remove • drag a hidden widget onto the grid to place it";
  if (drag?.source === "grid") {
    paletteHint = isRemovingByDrop
      ? `Release to remove ${getWidgetLabel(drag.widget)}`
      : "Drop here to remove from dashboard";
  }

  return (
    <div className={[styles.layoutEditor, drag ? styles.layoutEditorDragging : ""].join(" ")}>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Widget palette */}
      <div
        ref={paletteRef}
        className={[
          styles.widgetPalette,
          drag?.source === "grid" ? styles.widgetPaletteDropZone : "",
          isRemovingByDrop ? styles.widgetPaletteDropActive : "",
        ].join(" ")}
      >
        <span className={styles.widgetPaletteLabel}>
          {visibleWidgets.length}/{allWidgets.length} widgets on dashboard
        </span>
        <div className={styles.widgetPaletteGroups}>
          {groupedWidgets.map((group) => (
            <div key={group.id} className={styles.widgetPaletteGroup}>
              <span className={styles.widgetPaletteGroupTitle}>{group.label}</span>
              <div className={styles.widgetPaletteChips}>
                {group.widgets.map((widget) => {
                  const isVisible = visibility[widget];
                  const label = getWidgetLabel(widget);
                  return (
                    <button
                      key={widget}
                      type="button"
                      className={[
                        styles.widgetChip,
                        isVisible ? styles.widgetChipVisible : styles.widgetChipHidden,
                        drag?.widget === widget ? styles.widgetChipDragging : "",
                      ].join(" ")}
                      onClick={() => handlePaletteWidgetClick(widget)}
                      onPointerDown={!isVisible ? handleDragPointerDown(widget, "palette") : undefined}
                      onContextMenu={!isVisible ? (e) => e.preventDefault() : undefined}
                      aria-label={isVisible ? `${label} is on the dashboard` : `Add ${label} to dashboard`}
                      title={isVisible ? `${label} is on the dashboard — click to remove` : `Add ${label} to dashboard`}
                    >
                      {!isVisible && <GripVertical size={12} />}
                      <span>{label}</span>
                      <span className={styles.widgetSizeLabel}>
                        {MIN_WIDGET_SIZE[widget].columnSpan}×{MIN_WIDGET_SIZE[widget].rowSpan}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <span className={styles.widgetPaletteHint}>{paletteHint}</span>
      </div>

      {/* Grid with row controls */}
      <div className={styles.layoutGridWrapper}>
        <div className={styles.layoutGridArea}>
          {/* Row gutter: insert a row above, or delete a specific row */}
          <div
            className={styles.rowGutter}
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(4.5rem, 1fr))` }}
          >
            {Array.from({ length: rowCount }, (_, index) => {
              const row = index + 1;
              const canDelete = rowRemovals[index] !== null;
              const deleteLabel = describeRowDeletion(row);
              return (
                <div
                  key={row}
                  className={[
                    styles.rowGutterCell,
                    rowPreview?.row === row ? styles.rowGutterCellActive : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    className={styles.rowGutterBtn}
                    onClick={() => handleInsertRow(row)}
                    disabled={rowCount >= MAX_GRID_ROWS}
                    aria-label={`Insert a row above row ${row}`}
                    title={rowCount >= MAX_GRID_ROWS ? `The grid has at most ${MAX_GRID_ROWS} rows` : `Insert a row above row ${row}`}
                    {...previewRowHandlers({ kind: "insert", row })}
                  >
                    <Plus size={12} />
                  </button>
                  <span className={styles.rowGutterNumber} aria-hidden="true">{row}</span>
                  <button
                    type="button"
                    className={[styles.rowGutterBtn, styles.rowGutterBtnDanger].join(" ")}
                    onClick={() => handleDeleteRow(row)}
                    disabled={!canDelete}
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    {...previewRowHandlers(canDelete ? { kind: "delete", row } : null)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div
            ref={gridRef}
            className={[
              styles.layoutGrid,
              drag ? styles.layoutGridDragging : "",
              resizingWidget ? styles.layoutGridResizing : "",
            ].join(" ")}
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(4.5rem, 1fr))` }}
          >
            {/* Background cells */}
            {Array.from({ length: rowCount * WIDGET_GRID_COLUMNS }, (_, i) => {
              const col = (i % WIDGET_GRID_COLUMNS) + 1;
              const row = Math.floor(i / WIDGET_GRID_COLUMNS) + 1;
              return (
                <div
                  key={`${row}-${col}`}
                  className={[
                    styles.layoutCell,
                    rowPreview?.kind === "delete" && rowPreview.row === row ? styles.layoutCellDeletePreview : "",
                  ].join(" ")}
                  style={{ gridColumn: col, gridRow: row }}
                />
              );
            })}

            {/* Placed widgets */}
            {visibleWidgets.map((widget) => {
              const p = placements[widget];
              const label = getWidgetLabel(widget);
              return (
                <div
                  key={widget}
                  data-testid={`layout-widget-${widget}`}
                  role="group"
                  aria-roledescription="draggable widget"
                  aria-label={`${label}, column ${p.column}, row ${p.row}, ${p.columnSpan} by ${p.rowSpan}`}
                  aria-describedby={keyboardHintId}
                  tabIndex={0}
                  className={[
                    styles.layoutWidget,
                    resizingWidget === widget ? styles.layoutWidgetResizing : "",
                    drag?.widget === widget ? styles.layoutWidgetDragging : "",
                    swapPartner === widget ? styles.layoutWidgetSwapTarget : "",
                    deletePreview?.shrunk.includes(widget) ? styles.layoutWidgetShrinking : "",
                    deletePreview?.removed.includes(widget) ? styles.layoutWidgetDoomed : "",
                  ].join(" ")}
                  style={{
                    gridColumn: `${p.column} / span ${p.columnSpan}`,
                    gridRow: `${p.row} / span ${p.rowSpan}`,
                  }}
                  onPointerDown={handleDragPointerDown(widget, "grid")}
                  onKeyDown={handleWidgetKeyDown(widget)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className={styles.layoutWidgetInner}>
                    <GripVertical size={14} className={styles.layoutWidgetGrip} />
                    <span className={styles.layoutWidgetLabel}>{label}</span>
                    <span className={styles.layoutWidgetSize}>{p.columnSpan}&times;{p.rowSpan}</span>
                    <button
                      className={styles.layoutWidgetRemove}
                      onClick={() => {
                        onToggleWidget(widget, false);
                        setAnnouncement(`Removed ${label} from dashboard`);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={`Remove ${label} from dashboard`}
                      title={`Remove ${label}`}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.layoutWidgetResizeHandle}
                    onPointerDown={handleResizePointerDown(widget)}
                    title="Drag to resize"
                    aria-label={`Resize ${label}`}
                  />
                </div>
              );
            })}

            {/* Where an inserted row will appear */}
            {rowPreview?.kind === "insert" && (
              <div
                className={styles.rowInsertMarker}
                style={{ gridColumn: "1 / -1", gridRow: rowPreview.row }}
                aria-hidden="true"
              />
            )}

            {/* Footprint preview of where the dragged widget will land */}
            {drag?.target && !drag.overNewRow && (
              <div
                className={[styles.dropPreview, previewClass].join(" ")}
                style={{
                  gridColumn: `${drag.target.column} / span ${drag.target.columnSpan}`,
                  gridRow: `${drag.target.row} / span ${drag.target.rowSpan}`,
                }}
                aria-hidden="true"
              >
                <span className={styles.dropPreviewLabel}>{previewText}</span>
              </div>
            )}
          </div>
        </div>

        {showNewRowZone ? (
          <div
            ref={newRowZoneRef}
            className={[
              styles.newRowZone,
              drag.overNewRow ? (drag.patch ? styles.newRowZoneActive : styles.newRowZoneInvalid) : "",
            ].join(" ")}
            aria-hidden="true"
          >
            <Plus size={14} />
            <span>{newRowZoneText}</span>
          </div>
        ) : (
          <div className={styles.layoutRowControls}>
            <button
              className={styles.layoutRowBtn}
              onClick={() => {
                if (removableRow !== null) handleDeleteRow(removableRow);
              }}
              disabled={removableRow === null}
              aria-label="Remove row"
              title={removeRowTitle}
              type="button"
              {...previewRowHandlers(removableRow === null ? null : { kind: "delete", row: removableRow })}
            >
              −
            </button>
            <span className={styles.layoutRowLabel}>{rowCount} of {MAX_GRID_ROWS} rows</span>
            <button
              className={styles.layoutRowBtn}
              onClick={() => handleInsertRow(rowCount + 1)}
              disabled={rowCount >= MAX_GRID_ROWS}
              aria-label="Add row"
              title={rowCount >= MAX_GRID_ROWS ? `The grid has at most ${MAX_GRID_ROWS} rows` : "Add a row at the bottom"}
              type="button"
            >
              +
            </button>
          </div>
        )}
      </div>

      <p id={keyboardHintId} className={styles.layoutEditorHint}>
        Drag a widget to move it, or drop it on another widget to swap them &bull; drag the corner to resize &bull;
        on touch, press and hold to drag &bull; keyboard: arrow keys move, Shift+arrow keys resize, Delete removes
      </p>

      {/* Floating label that follows the pointer while dragging */}
      {drag &&
        createPortal(
          <div
            className={[
              styles.dragGhost,
              drag.patch || isRemovingByDrop ? "" : styles.dragGhostInvalid,
            ].join(" ")}
            style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
            aria-hidden="true"
          >
            {isRemovingByDrop ? <X size={12} /> : <GripVertical size={12} />}
            <span>{getWidgetLabel(drag.widget)}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
