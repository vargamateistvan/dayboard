import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useSettings } from "../lib/useSettings";
import {
  createSavedMediaLink,
  formatSavedLinkLabel,
  normalizeSavedMediaLinks,
  removeSavedMediaLink,
  type SavedMediaLink,
  resolveMediaLinkTitle,
} from "../lib/mediaLinks";
import {
  normalizeAppleMusicEmbedUrl,
  normalizeApplePodcastEmbedUrl,
  normalizeSpotifyEmbedUrl,
} from "../lib/musicEmbeds";
import {
  WIDGET_GRID_COLUMNS,
  MIN_GRID_ROWS,
  MAX_GRID_ROWS,
  canPlaceWidget,
  MIN_WIDGET_SIZE,
  type WidgetColumnSpan,
  type WidgetGridColumn,
  type WidgetGridRow,
  type WidgetLayoutState,
  type WidgetPlacement,
  type WidgetRowSpan,
  type Widget,
  useWidgetVisibility,
} from "../lib/useWidgetVisibility";
import { getWidgetLabel } from "../lib/widgetMetadata";
import {
  DEFAULT_CALENDAR_COLORS,
  DEFAULT_CUSTOM_COLORS,
  FONT_PRESET_OPTIONS,
  applyPreset,
  deletePreset,
  isPresetScheduledNow,
  listPresets,
  renamePreset,
  savePreset,
  type Settings,
  type SettingsPreset,
  type SettingsPresetSchedule,
  updatePresetSchedule,
  type CalendarFeed,
  type CalendarExtraInfoPreview,
  type CalendarWeekStartsOn,
  type Theme,
  type ColorScheme,
  type CustomColors,
  type WeatherUnitSystem,
  DEFAULT_SETTINGS,
} from "../lib/settings";
import {
  Globe,
  Monitor,
  Zap,
  Leaf,
  Waves,
  Palette,
  Type,
  Sun,
  Moon,
  SunMoon,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { MediaBrandIcon } from "./MediaBrandIcon";
import styles from "./SettingsDialog.module.css";

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: "default", label: "Default", icon: <Globe size={16} /> },
  { id: "retro", label: "Retro", icon: <Monitor size={16} /> },
  { id: "futuristic", label: "Futuristic", icon: <Zap size={16} /> },
  { id: "nature", label: "Nature", icon: <Leaf size={16} /> },
  { id: "ocean", label: "Ocean", icon: <Waves size={16} /> },
  { id: "sunset", label: "Sunset", icon: <Palette size={16} /> },
  { id: "custom", label: "Custom", icon: <Palette size={16} /> },
];

const COLOR_SCHEMES: {
  id: ColorScheme;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "system", label: "System", icon: <SunMoon size={14} /> },
  { id: "light", label: "Light", icon: <Sun size={14} /> },
  { id: "dark", label: "Dark", icon: <Moon size={14} /> },
];

const WEATHER_UNITS: { id: WeatherUnitSystem; label: string }[] = [
  { id: "metric", label: "Metric" },
  { id: "imperial", label: "Imperial" },
];

const CALENDAR_WEEK_STARTS: { id: CalendarWeekStartsOn; label: string }[] = [
  { id: "monday", label: "Monday" },
  { id: "sunday", label: "Sunday" },
];

const CALENDAR_EXTRA_INFO_PREVIEW_OPTIONS: {
  id: CalendarExtraInfoPreview;
  label: string;
}[] = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
];

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

type BackgroundMode = "solid" | "gradient";

interface ParsedBackground {
  mode: BackgroundMode;
  solid: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
}

const DEFAULT_BACKGROUND_GRADIENT = {
  from: DEFAULT_CUSTOM_COLORS.background,
  to: "#1d4ed8",
  angle: 135,
} as const;

const GRADIENT_BACKGROUND_REGEX =
  /^linear-gradient\(\s*([0-9]+(?:\.[0-9]+)?)deg,\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)$/i;

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  return isHexColor(trimmed) ? trimmed : fallback;
}

function normalizeGradientAngle(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_BACKGROUND_GRADIENT.angle;
  }

  return Math.min(360, Math.max(0, Math.round(value)));
}

function formatLinearGradient(angle: number, from: string, to: string): string {
  return `linear-gradient(${normalizeGradientAngle(angle)}deg, ${from}, ${to})`;
}

function parseBackground(value: string): ParsedBackground {
  const trimmed = value.trim();
  const gradientMatch = trimmed.match(GRADIENT_BACKGROUND_REGEX);

  if (gradientMatch) {
    return {
      mode: "gradient",
      solid: gradientMatch[2],
      gradientFrom: gradientMatch[2],
      gradientTo: gradientMatch[3],
      gradientAngle: normalizeGradientAngle(Number(gradientMatch[1])),
    };
  }

  const solid = normalizeHexColor(trimmed, DEFAULT_CUSTOM_COLORS.background);

  return {
    mode: "solid",
    solid,
    gradientFrom: solid,
    gradientTo: DEFAULT_BACKGROUND_GRADIENT.to,
    gradientAngle: DEFAULT_BACKGROUND_GRADIENT.angle,
  };
}

interface Props {
  readonly onClose: () => void;
  readonly selectedPresetName?: string;
}

type SettingsTabId = "appearance" | "layout" | "widgets" | "presets";

const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTabId; label: string; description: string }> = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, colors, fonts, and support options.",
  },
  {
    id: "layout",
    label: "Layout",
    description: "Widget placement and dashboard structure.",
  },
  {
    id: "widgets",
    label: "Widgets",
    description: "Widget-specific content and refresh behavior.",
  },
  {
    id: "presets",
    label: "Presets",
    description: "Save named setups and schedule automatic switching.",
  },
] as const;

const DEFAULT_PRESET_SCHEDULE: SettingsPresetSchedule = {
  enabled: true,
  startTime: "09:00",
  endTime: "17:00",
};

function formatPresetTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPresetSchedule(schedule?: SettingsPresetSchedule): string {
  if (!schedule?.enabled) {
    return "Manual only";
  }

  return `Daily ${schedule.startTime}–${schedule.endTime}`;
}

interface WidgetLayoutEditorProps {
  readonly order: Widget[];
  readonly visibility: Record<Widget, boolean>;
  readonly placements: Record<Widget, WidgetPlacement>;
  readonly rowCount: number;
  readonly onSetWidgetPlacement: (
    widget: Widget,
    placement: WidgetPlacement,
  ) => void;
  readonly onToggleWidget: (widget: Widget, visible?: boolean) => void;
  readonly onAddRow: () => void;
  readonly onRemoveRow: () => void;
}

const WIDGET_CHIP_GROUPS: ReadonlyArray<{
  id: "core" | "productivity" | "media" | "finance";
  label: string;
  widgets: readonly Widget[];
}> = [
  {
    id: "core",
    label: "Core",
    widgets: ["clock", "timezoneClock", "weather", "flights", "calendar", "deviceInfo"],
  },
  {
    id: "productivity",
    label: "Productivity",
    widgets: ["timer", "tasks", "notes", "quote"],
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
] as const;

interface MediaLinkEditorProps {
  readonly title: string;
  readonly brand: "spotify" | "apple-music" | "apple-podcasts";
  readonly activeUrl: string;
  readonly savedLinks: SavedMediaLink[];
  readonly addUrl: string;
  readonly addPlaceholder: string;
  readonly onSelectUrl: (url: string) => void;
  readonly onRemoveSelected: () => void;
  readonly onAddUrlChange: (value: string) => void;
  readonly onAddLink: () => void;
  readonly error: string | null;
}

function MediaLinkEditor({
  title,
  brand,
  activeUrl,
  savedLinks,
  addUrl,
  addPlaceholder,
  onSelectUrl,
  onRemoveSelected,
  onAddUrlChange,
  onAddLink,
  error,
}: MediaLinkEditorProps) {
  return (
    <div className={styles.mediaLinkEditor}>
      <label className={styles.intervalLabel}>
        <span className={styles.mediaLinkLabel}>
          <MediaBrandIcon brand={brand} size={20} className={styles.mediaLinkLogo} />
          <span>{title} saved links</span>
        </span>
        <div className={styles.mediaLinkSelectRow}>
          <select
            className={styles.input}
            value={activeUrl}
            onChange={(e) => onSelectUrl(e.target.value)}
            disabled={savedLinks.length === 0}
          >
            {savedLinks.length === 0 ? (
              <option value="">No saved links yet</option>
            ) : (
              savedLinks.map((entry) => (
                <option key={entry.url} value={entry.url}>
                  {formatSavedLinkLabel(entry)}
                </option>
              ))
            )}
          </select>
          <button
            className={styles.mediaLinkRemoveButton}
            type="button"
            onClick={onRemoveSelected}
            disabled={!activeUrl}
            aria-label={`Remove selected ${title} link`}
            title={`Remove selected ${title} link`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </label>

      <label className={styles.intervalLabel}>
        <span className={styles.mediaLinkLabel}>
          <MediaBrandIcon brand={brand} size={20} className={styles.mediaLinkLogo} />
          <span>Add link</span>
        </span>
        <div className={styles.mediaLinkRow}>
          <input
            className={[styles.input, styles.mediaLinkInput].join(" ")}
            type="url"
            placeholder={addPlaceholder}
            value={addUrl}
            onChange={(e) => onAddUrlChange(e.target.value)}
          />
          <button
            className={styles.mediaLinkButton}
            type="button"
            onClick={onAddLink}
          >
            Add
          </button>
        </div>
      </label>

      {error && <p className={styles.mediaLinkError}>{error}</p>}
    </div>
  );
}

function WidgetLayoutEditor({
  order,
  visibility,
  placements,
  rowCount,
  onSetWidgetPlacement,
  onToggleWidget,
  onAddRow,
  onRemoveRow,
}: WidgetLayoutEditorProps) {
  const [paletteDragWidget, setPaletteDragWidget] = useState<Widget | null>(null);
  const [gridDragWidget, setGridDragWidget] = useState<Widget | null>(null);
  const [dropTargetCell, setDropTargetCell] = useState<{ column: WidgetGridColumn; row: WidgetGridRow } | null>(null);
  const [resizingWidget, setResizingWidget] = useState<Widget | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    startColumnSpan: WidgetColumnSpan;
    startRowSpan: WidgetRowSpan;
    cellWidth: number;
    cellHeight: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const visibleWidgets = order.filter((w) => visibility[w]);
  const hiddenWidgets = order.filter((w) => !visibility[w]);
  const allWidgets = [...visibleWidgets, ...hiddenWidgets];
  const dragWidget = paletteDragWidget ?? gridDragWidget;
  const groupedWidgets = WIDGET_CHIP_GROUPS
    .map((group) => ({
      ...group,
      widgets: allWidgets.filter((widget) => group.widgets.includes(widget)),
    }))
    .filter((group) => group.widgets.length > 0);

  const canUsePlacement = (widget: Widget, patch: Partial<WidgetPlacement>) =>
    canPlaceWidget(placements, visibility, widget, {
      ...placements[widget],
      ...patch,
    }, rowCount);

  const getCellFromPoint = (clientX: number, clientY: number): { column: WidgetGridColumn; row: WidgetGridRow } | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width - 1);
    const relY = Math.min(Math.max(clientY - rect.top, 0), rect.height - 1);
    const column = Math.min(
      WIDGET_GRID_COLUMNS,
      Math.floor((relX / rect.width) * WIDGET_GRID_COLUMNS) + 1,
    ) as WidgetGridColumn;
    const row = Math.min(
      rowCount,
      Math.floor((relY / rect.height) * rowCount) + 1,
    );
    return { column, row };
  };

  const handlePaletteDragStart = (widget: Widget) => (e: React.DragEvent) => {
    setPaletteDragWidget(widget);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", widget);
  };

  const handlePaletteDragEnd = () => {
    setPaletteDragWidget(null);
    setDropTargetCell(null);
  };

  const handleGridDragStart = (widget: Widget) => (e: React.DragEvent) => {
    setGridDragWidget(widget);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", widget);
  };

  const handleGridDragEnd = () => {
    setGridDragWidget(null);
    setDropTargetCell(null);
  };

  const handleGridDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragWidget) return;
    e.preventDefault();
    const cell = getCellFromPoint(e.clientX, e.clientY);
    setDropTargetCell(cell);
  };

  const handleGridDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const widgetId = (e.dataTransfer.getData("text/plain") || dragWidget) as Widget | "";
    const widget = order.find((w) => w === widgetId);
    if (!widget) {
      setPaletteDragWidget(null);
      setGridDragWidget(null);
      setDropTargetCell(null);
      return;
    }
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell && canUsePlacement(widget, { column: cell.column, row: cell.row })) {
      onSetWidgetPlacement(widget, { ...placements[widget], column: cell.column, row: cell.row });
      if (!visibility[widget]) {
        onToggleWidget(widget, true);
      }
    }
    setPaletteDragWidget(null);
    setGridDragWidget(null);
    setDropTargetCell(null);
  };

  const handleGridDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDropTargetCell(null);
    }
  };

  const handleResizeMouseDown = (widget: Widget) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellWidth = rect.width / WIDGET_GRID_COLUMNS;
    const cellHeight = rect.height / rowCount;
    setResizingWidget(widget);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startColumnSpan: placements[widget].columnSpan,
      startRowSpan: placements[widget].rowSpan,
      cellWidth,
      cellHeight,
    };

    const onMouseMove = (mv: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { startX, startY, startColumnSpan, startRowSpan, cellWidth, cellHeight } = resizeStartRef.current;
      const placement = placements[widget];
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      const newColumnSpan = Math.min(
        WIDGET_GRID_COLUMNS - placement.column + 1,
        Math.max(1, startColumnSpan + Math.round(dx / cellWidth)),
      ) as WidgetColumnSpan;
      const newRowSpan = Math.min(
        rowCount - placement.row + 1,
        Math.max(1, startRowSpan + Math.round(dy / cellHeight)),
      ) as WidgetRowSpan;
      if (
        (newColumnSpan !== placement.columnSpan || newRowSpan !== placement.rowSpan) &&
        canUsePlacement(widget, { columnSpan: newColumnSpan, rowSpan: newRowSpan })
      ) {
        onSetWidgetPlacement(widget, { ...placement, columnSpan: newColumnSpan, rowSpan: newRowSpan });
      }
    };

    const onMouseUp = () => {
      setResizingWidget(null);
      resizeStartRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleRemoveWidget = (widget: Widget) => {
    onToggleWidget(widget, false);
  };

  return (
    <div className={styles.layoutEditor}>
      {/* Widget palette */}
      <div className={styles.widgetPalette}>
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
                  return (
                    <div
                      key={widget}
                      className={[
                        styles.widgetChip,
                        isVisible ? styles.widgetChipVisible : styles.widgetChipHidden,
                      ].join(" ")}
                      draggable={!isVisible}
                      onDragStart={!isVisible ? handlePaletteDragStart(widget) : undefined}
                      onDragEnd={!isVisible ? handlePaletteDragEnd : undefined}
                      aria-label={isVisible ? `${getWidgetLabel(widget)} is on the dashboard` : `Drag ${getWidgetLabel(widget)} onto the grid`}
                      title={isVisible ? `${getWidgetLabel(widget)} (on grid)` : `Drag to add ${getWidgetLabel(widget)}`}
                    >
                      {!isVisible && <GripVertical size={12} />}
                      <span>{getWidgetLabel(widget)}</span>
                      <span className={styles.widgetSizeLabel}>
                        {MIN_WIDGET_SIZE[widget].columnSpan}×{MIN_WIDGET_SIZE[widget].rowSpan}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <span className={styles.widgetPaletteHint}>Drag a hidden widget onto the grid to show it</span>
      </div>

      {/* Grid with row controls */}
      <div className={styles.layoutGridWrapper}>
        <div
          ref={gridRef}
          className={[
            styles.layoutGrid,
            resizingWidget ? styles.layoutGridResizing : "",
          ].join(" ")}
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(4.5rem, 1fr))` }}
          onDragOver={handleGridDragOver}
          onDrop={handleGridDrop}
          onDragLeave={handleGridDragLeave}
        >
        {/* Background cells */}
        {Array.from({ length: rowCount * WIDGET_GRID_COLUMNS }, (_, i) => {
          const col = ((i % WIDGET_GRID_COLUMNS) + 1) as WidgetGridColumn;
          const row = Math.floor(i / WIDGET_GRID_COLUMNS) + 1;
          const isDropTarget = dropTargetCell?.column === col && dropTargetCell?.row === row;
          const canDrop = dragWidget ? canUsePlacement(dragWidget, { column: col, row: row }) : false;
          let cellStateClass = "";
          if (dragWidget) {
            cellStateClass = canDrop ? styles.layoutCellAvailable : styles.layoutCellBlocked;
          }
          return (
            <div
              key={`${row}-${col}`}
              className={[
                styles.layoutCell,
                cellStateClass,
                isDropTarget && canDrop ? styles.layoutCellDropTarget : "",
              ].join(" ")}
              style={{ gridColumn: col, gridRow: row }}
            />
          );
        })}

        {/* Placed widgets */}
        {visibleWidgets.map((widget) => {
          const p = placements[widget];
          const isResizing = resizingWidget === widget;
          return (
            <div
              key={widget}
              data-testid={`layout-widget-${widget}`}
              className={[
                styles.layoutWidget,
                isResizing ? styles.layoutWidgetResizing : "",
              ].join(" ")}
              style={{
                gridColumn: `${p.column} / span ${p.columnSpan}`,
                gridRow: `${p.row} / span ${p.rowSpan}`,
              }}
              draggable
              onDragStart={handleGridDragStart(widget)}
              onDragEnd={handleGridDragEnd}
            >
              <div className={styles.layoutWidgetInner}>
                <GripVertical size={14} className={styles.layoutWidgetGrip} />
                <span className={styles.layoutWidgetLabel}>{getWidgetLabel(widget)}</span>
                <span className={styles.layoutWidgetSize}>{p.columnSpan}&times;{p.rowSpan}</span>
                <button
                  className={styles.layoutWidgetRemove}
                  onClick={() => handleRemoveWidget(widget)}
                  aria-label={`Remove ${getWidgetLabel(widget)} from dashboard`}
                  type="button"
                >
                  <X size={12} />
                </button>
              </div>
              <button
                type="button"
                className={styles.layoutWidgetResizeHandle}
                onMouseDown={handleResizeMouseDown(widget)}
                title="Drag to resize"
                aria-label={`Resize ${getWidgetLabel(widget)}`}
              />
            </div>
          );
        })}
        </div>

        {/* Row controls */}
        <div className={styles.layoutRowControls}>
          <button
            className={styles.layoutRowBtn}
            onClick={onRemoveRow}
            disabled={rowCount <= MIN_GRID_ROWS}
            aria-label="Remove row"
            title="Remove a row"
            type="button"
          >
            −
          </button>
          <span className={styles.layoutRowLabel}>{rowCount} rows</span>
          <button
            className={styles.layoutRowBtn}
            onClick={onAddRow}
            disabled={rowCount >= MAX_GRID_ROWS}
            aria-label="Add row"
            title="Add a row"
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <p className={styles.layoutEditorHint}>
        Drag widgets onto the grid &bull; drag the corner handle to resize &bull; &times; to remove
      </p>
    </div>
  );
}

interface PresetCardProps {
  readonly preset: SettingsPreset;
  readonly draftSettings: Settings;
  readonly draftLayout: WidgetLayoutState;
  readonly isActive: boolean;
  readonly onRefresh: () => void;
  readonly onApply: (preset: SettingsPreset) => void;
  readonly onEdit: (preset: SettingsPreset) => void;
  readonly onRename: (oldName: string, newName: string) => void;
}

function PresetCard({
  preset,
  draftSettings,
  draftLayout,
  isActive,
  onRefresh,
  onApply,
  onEdit,
  onRename,
}: PresetCardProps) {
  const [scheduleEnabled, setScheduleEnabled] = useState(preset.schedule?.enabled ?? false);
  const [startTime, setStartTime] = useState(
    preset.schedule?.startTime ?? DEFAULT_PRESET_SCHEDULE.startTime,
  );
  const [endTime, setEndTime] = useState(
    preset.schedule?.endTime ?? DEFAULT_PRESET_SCHEDULE.endTime,
  );
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    setScheduleEnabled(preset.schedule?.enabled ?? false);
    setStartTime(preset.schedule?.startTime ?? DEFAULT_PRESET_SCHEDULE.startTime);
    setEndTime(preset.schedule?.endTime ?? DEFAULT_PRESET_SCHEDULE.endTime);
  }, [preset]);

  const handleSaveCurrent = () => {
    savePreset(
      preset.name,
      draftSettings,
      scheduleEnabled
        ? {
            enabled: true,
            startTime,
            endTime,
          }
        : undefined,
      draftLayout,
    );
    onRefresh();
  };

  const handleSaveSchedule = () => {
    updatePresetSchedule(
      preset.name,
      scheduleEnabled
        ? {
            enabled: true,
            startTime,
            endTime,
          }
        : undefined,
    );
    onRefresh();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) {
      return;
    }

    deletePreset(preset.name);
    onRefresh();
  };

  const handleRename = () => {
    const nextName = window.prompt('Rename preset', preset.name);
    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === preset.name) {
      return;
    }

    try {
      renamePreset(preset.name, trimmedName);
      setRenameError(null);
      onRename(preset.name, trimmedName);
      onRefresh();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Unable to rename preset.')
    }
  };

  return (
    <article className={styles.presetCard}>
      <div className={styles.presetCardHeader}>
        <div>
          <div className={styles.presetCardTitleRow}>
            <h4 className={styles.presetCardTitle}>{preset.name}</h4>
            {isActive && <span className={styles.presetBadge}>Active now</span>}
          </div>
          <p className={styles.presetMeta}>Updated {formatPresetTimestamp(preset.updatedAt)}</p>
        </div>
        <div className={styles.presetActions}>
          <button
            className={styles.btnGhost}
            onClick={() => {
              applyPreset(preset.name);
              onApply(preset);
            }}
            type="button"
          >
            Apply
          </button>
          <button
            className={styles.btnGhost}
            onClick={() => onEdit(preset)}
            type="button"
          >
            Edit
          </button>
          <button
            className={styles.btnGhost}
            onClick={handleRename}
            type="button"
          >
            Rename
          </button>
          <button
            className={styles.btnGhost}
            onClick={handleSaveCurrent}
            type="button"
          >
            Save current
          </button>
          <button
            className={styles.btnGhost}
            onClick={handleDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      <div className={styles.presetSchedule}>
        <div className={styles.presetScheduleHeader}>
          <div>
            <p className={styles.presetScheduleLabel}>Auto-apply window</p>
            <p className={styles.presetScheduleSummary}>
              {formatPresetSchedule(
                scheduleEnabled
                  ? {
                      enabled: true,
                      startTime,
                      endTime,
                    }
                  : undefined,
              )}
            </p>
          </div>
          <button
            className={[
              styles.widgetToggle,
              scheduleEnabled ? styles.widgetVisible : "",
            ].join(" ")}
            onClick={() => setScheduleEnabled((value) => !value)}
            type="button"
            aria-pressed={scheduleEnabled}
          >
            {scheduleEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{scheduleEnabled ? "Enabled" : "Disabled"}</span>
          </button>
        </div>

        {scheduleEnabled && (
          <div className={styles.presetScheduleInputs}>
            <label className={styles.intervalLabel}>
              <span>Start</span>
              <input
                className={styles.input}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className={styles.intervalLabel}>
              <span>End</span>
              <input
                className={styles.input}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
        )}

        <button className={styles.btnGhost} onClick={handleSaveSchedule} type="button">
          Save schedule
        </button>
      </div>
      {renameError && <p className={styles.mediaLinkError}>{renameError}</p>}
    </article>
  );
}

export function SettingsDialog({ onClose, selectedPresetName }: Props) {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("appearance");
  const {
    visibility,
    order,
    placements,
    rowCount,
    toggleWidget,
    setWidgetPlacement,
    addRow,
    removeRow,
  } = useWidgetVisibility();
  const [calendarFeeds, setCalendarFeeds] = useState<CalendarFeed[]>(
    settings.calendarFeeds.length > 0
      ? settings.calendarFeeds
      : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }],
  );
  const [globalCalendarFeeds, setGlobalCalendarFeeds] = useState<CalendarFeed[]>(
    settings.globalCalendarFeeds.length > 0
      ? settings.globalCalendarFeeds
      : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }],
  );
  const [weatherRefreshMin, setWeatherRefreshMin] = useState(
    settings.weatherRefreshMinutes,
  );
  const [weatherUnitSystem, setWeatherUnitSystem] = useState<WeatherUnitSystem>(
    settings.weatherUnitSystem,
  );
  const [weatherShowExtraDetails, setWeatherShowExtraDetails] = useState(
    settings.weatherShowExtraDetails,
  );
  const [flightsRadiusKm, setFlightsRadiusKm] = useState(settings.flightsRadiusKm);
  const [flightsRadarRadiusKm, setFlightsRadarRadiusKm] = useState(
    settings.flightsRadarRadiusKm,
  );
  const [flightsRefreshSeconds, setFlightsRefreshSeconds] = useState(
    settings.flightsRefreshSeconds,
  );
  const [flightsShowLabels, setFlightsShowLabels] = useState(
    settings.flightsShowLabels,
  );
  const [flightsShowOnlyAirborne, setFlightsShowOnlyAirborne] = useState(
    settings.flightsShowOnlyAirborne,
  );
  const [flightsUseDeviceLocation, setFlightsUseDeviceLocation] = useState(
    settings.flightsUseDeviceLocation,
  );
  const [flightsManualLatitude, setFlightsManualLatitude] = useState(
    settings.flightsManualLatitude,
  );
  const [flightsManualLongitude, setFlightsManualLongitude] = useState(
    settings.flightsManualLongitude,
  );
  const [worldClockCity, setWorldClockCity] = useState(settings.worldClockCity);
  const [worldClockTimeZone, setWorldClockTimeZone] = useState(
    settings.worldClockTimeZone,
  );
  const [worldClockTimeZoneError, setWorldClockTimeZoneError] = useState<
    string | null
  >(null);
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState(settings.spotifyEmbedUrl);
  const [spotifyEmbedLinks, setSpotifyEmbedLinks] = useState(
    normalizeSavedMediaLinks(settings.spotifyEmbedLinks, settings.spotifyEmbedUrl),
  );
  const [spotifyAddUrl, setSpotifyAddUrl] = useState("");
  const [spotifyLinkError, setSpotifyLinkError] = useState<string | null>(null);
  const [appleMusicEmbedUrl, setAppleMusicEmbedUrl] = useState(settings.appleMusicEmbedUrl);
  const [appleMusicEmbedLinks, setAppleMusicEmbedLinks] = useState(
    normalizeSavedMediaLinks(settings.appleMusicEmbedLinks, settings.appleMusicEmbedUrl),
  );
  const [appleMusicAddUrl, setAppleMusicAddUrl] = useState("");
  const [appleMusicLinkError, setAppleMusicLinkError] = useState<string | null>(null);
  const [applePodcastEmbedUrl, setApplePodcastEmbedUrl] = useState(settings.applePodcastEmbedUrl);
  const [applePodcastEmbedLinks, setApplePodcastEmbedLinks] = useState(
    normalizeSavedMediaLinks(settings.applePodcastEmbedLinks, settings.applePodcastEmbedUrl),
  );
  const [applePodcastAddUrl, setApplePodcastAddUrl] = useState("");
  const [applePodcastLinkError, setApplePodcastLinkError] = useState<string | null>(null);
  const [stockSymbols, setStockSymbols] = useState<string[]>(settings.stockSymbols);
  const [stockAddInput, setStockAddInput] = useState("");
  const [currencyPairs, setCurrencyPairs] = useState<[string, string][]>(settings.currencyPairs);
  const [currencyAddBase, setCurrencyAddBase] = useState("");
  const [currencyAddTarget, setCurrencyAddTarget] = useState("");
  const [financeRefreshMin, setFinanceRefreshMin] = useState(settings.financeRefreshMinutes);
  const [showBuyMeACoffeeWidget, setShowBuyMeACoffeeWidget] = useState(
    settings.showBuyMeACoffeeWidget,
  );
  const [calendarHidePastEvents, setCalendarHidePastEvents] = useState(
    settings.calendarHidePastEvents,
  );
  const [calendarShowMonthlyOverview, setCalendarShowMonthlyOverview] = useState(
    settings.calendarShowMonthlyOverview,
  );
  const [calendarExtraInfoPreview, setCalendarExtraInfoPreview] =
    useState<CalendarExtraInfoPreview>(settings.calendarExtraInfoPreview);
  const [calendarShowAllDayEvents, setCalendarShowAllDayEvents] = useState(
    settings.calendarShowAllDayEvents,
  );
  const [calendarWeekStartsOn, setCalendarWeekStartsOn] =
    useState<CalendarWeekStartsOn>(settings.calendarWeekStartsOn);
  const [workMin, setWorkMin] = useState(settings.pomodoroWorkMinutes);
  const [breakMin, setBreakMin] = useState(settings.pomodoroBreakMinutes);
  const [customColors, setCustomColors] = useState<CustomColors>(
    settings.customColors || DEFAULT_CUSTOM_COLORS,
  );
  const [presets, setPresets] = useState<SettingsPreset[]>(() => listPresets());
  const [presetName, setPresetName] = useState("");
  const [newPresetAutoApply, setNewPresetAutoApply] = useState(false);
  const [newPresetStartTime, setNewPresetStartTime] = useState(
    DEFAULT_PRESET_SCHEDULE.startTime,
  );
  const [newPresetEndTime, setNewPresetEndTime] = useState(
    DEFAULT_PRESET_SCHEDULE.endTime,
  );
  const [editingPresetName, setEditingPresetName] = useState<string>(selectedPresetName ?? "");
  const background = parseBackground(customColors.background);
  const isCalendarOnLayout = visibility.calendar;
  const isWeatherOnLayout = visibility.weather;
  const isFlightsOnLayout = visibility.flights;
  const isTimezoneClockOnLayout = visibility.timezoneClock;
  const isFinanceOnLayout = visibility.stocks || visibility.currencies;
  const isMusicOnLayout =
    visibility.spotify ||
    visibility.appleMusic ||
    visibility.applePodcast;
  const isSpotifyOnLayout = visibility.spotify;
  const isAppleMusicOnLayout = visibility.appleMusic;
  const isApplePodcastOnLayout = visibility.applePodcast;
  const isTimerOnLayout = visibility.timer;
  const activePresetName = presets.find((preset) => isPresetScheduledNow(preset.schedule))?.name ?? null;

  const refreshPresets = () => {
    setPresets(listPresets());
  };

  const syncDraftState = (nextSettings: Settings) => {
    setCalendarFeeds(
      nextSettings.calendarFeeds.length > 0
        ? nextSettings.calendarFeeds
        : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }],
    );
    setGlobalCalendarFeeds(
      nextSettings.globalCalendarFeeds.length > 0
        ? nextSettings.globalCalendarFeeds
        : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }],
    );
    setWeatherRefreshMin(nextSettings.weatherRefreshMinutes);
    setWeatherUnitSystem(nextSettings.weatherUnitSystem);
    setWeatherShowExtraDetails(nextSettings.weatherShowExtraDetails);
    setFlightsRadiusKm(nextSettings.flightsRadiusKm);
    setFlightsRadarRadiusKm(nextSettings.flightsRadarRadiusKm);
    setFlightsRefreshSeconds(nextSettings.flightsRefreshSeconds);
    setFlightsShowLabels(nextSettings.flightsShowLabels);
    setFlightsShowOnlyAirborne(nextSettings.flightsShowOnlyAirborne);
    setFlightsUseDeviceLocation(nextSettings.flightsUseDeviceLocation);
    setFlightsManualLatitude(nextSettings.flightsManualLatitude);
    setFlightsManualLongitude(nextSettings.flightsManualLongitude);
    setWorldClockCity(nextSettings.worldClockCity);
    setWorldClockTimeZone(nextSettings.worldClockTimeZone);
    setWorldClockTimeZoneError(null);
    setSpotifyEmbedUrl(nextSettings.spotifyEmbedUrl);
    setSpotifyEmbedLinks(
      normalizeSavedMediaLinks(nextSettings.spotifyEmbedLinks, nextSettings.spotifyEmbedUrl),
    );
    setSpotifyAddUrl("");
    setSpotifyLinkError(null);
    setAppleMusicEmbedUrl(nextSettings.appleMusicEmbedUrl);
    setAppleMusicEmbedLinks(
      normalizeSavedMediaLinks(nextSettings.appleMusicEmbedLinks, nextSettings.appleMusicEmbedUrl),
    );
    setAppleMusicAddUrl("");
    setAppleMusicLinkError(null);
    setApplePodcastEmbedUrl(nextSettings.applePodcastEmbedUrl);
    setApplePodcastEmbedLinks(
      normalizeSavedMediaLinks(nextSettings.applePodcastEmbedLinks, nextSettings.applePodcastEmbedUrl),
    );
    setApplePodcastAddUrl("");
    setApplePodcastLinkError(null);
    setStockSymbols(nextSettings.stockSymbols);
    setStockAddInput("");
    setCurrencyPairs(nextSettings.currencyPairs);
    setCurrencyAddBase("");
    setCurrencyAddTarget("");
    setFinanceRefreshMin(nextSettings.financeRefreshMinutes);
    setShowBuyMeACoffeeWidget(nextSettings.showBuyMeACoffeeWidget);
    setCalendarHidePastEvents(nextSettings.calendarHidePastEvents);
    setCalendarShowMonthlyOverview(nextSettings.calendarShowMonthlyOverview);
    setCalendarExtraInfoPreview(nextSettings.calendarExtraInfoPreview);
    setCalendarShowAllDayEvents(nextSettings.calendarShowAllDayEvents);
    setCalendarWeekStartsOn(nextSettings.calendarWeekStartsOn);
    setWorkMin(nextSettings.pomodoroWorkMinutes);
    setBreakMin(nextSettings.pomodoroBreakMinutes);
    setCustomColors(nextSettings.customColors || DEFAULT_CUSTOM_COLORS);
  };

  const buildDraftSettings = (): Settings => ({
    ...settings,
    calendarFeeds,
    globalCalendarFeeds,
    weatherRefreshMinutes: weatherRefreshMin,
    weatherUnitSystem,
    weatherShowExtraDetails,
    flightsRadiusKm,
    flightsRadarRadiusKm,
    flightsRefreshSeconds,
    flightsShowLabels,
    flightsShowOnlyAirborne,
    flightsUseDeviceLocation,
    flightsManualLatitude: flightsManualLatitude.trim(),
    flightsManualLongitude: flightsManualLongitude.trim(),
    worldClockCity: worldClockCity.trim() || settings.worldClockCity,
    worldClockTimeZone: worldClockTimeZone.trim() || settings.worldClockTimeZone,
    spotifyEmbedUrl,
    spotifyEmbedLinks: normalizeSavedMediaLinks(
      spotifyEmbedLinks,
      spotifyEmbedUrl ? createSavedMediaLink(spotifyEmbedUrl) : undefined,
    ),
    appleMusicEmbedUrl,
    appleMusicEmbedLinks: normalizeSavedMediaLinks(
      appleMusicEmbedLinks,
      appleMusicEmbedUrl ? createSavedMediaLink(appleMusicEmbedUrl) : undefined,
    ),
    applePodcastEmbedUrl,
    applePodcastEmbedLinks: normalizeSavedMediaLinks(
      applePodcastEmbedLinks,
      applePodcastEmbedUrl ? createSavedMediaLink(applePodcastEmbedUrl) : undefined,
    ),
    stockSymbols,
    currencyPairs,
    financeRefreshMinutes: financeRefreshMin,
    showBuyMeACoffeeWidget,
    calendarHidePastEvents,
    calendarShowMonthlyOverview,
    calendarExtraInfoPreview,
    calendarShowAllDayEvents,
    calendarWeekStartsOn,
    pomodoroWorkMinutes: workMin,
    pomodoroBreakMinutes: breakMin,
    customColors,
  });

  const buildDraftLayout = (): WidgetLayoutState => ({
    rowCount,
    visibility: structuredClone(visibility),
    placements: structuredClone(placements),
  });

  useEffect(() => {
    if (selectedPresetName) {
      setEditingPresetName(selectedPresetName);
    }
  }, [selectedPresetName]);

  const updateCalendarFeed = (index: number, patch: Partial<CalendarFeed>) => {
    setCalendarFeeds((prev) =>
      prev.map((calendarFeed, currentIndex) =>
        currentIndex === index ? { ...calendarFeed, ...patch } : calendarFeed,
      ),
    );
  };

  const addCalendarFeed = () => {
    setCalendarFeeds((prev) => [
      ...prev,
      {
        url: "",
        color:
          DEFAULT_CALENDAR_COLORS[prev.length % DEFAULT_CALENDAR_COLORS.length],
      },
    ]);
  };

  const removeCalendarFeed = (index: number) => {
    setCalendarFeeds((prev) => {
      const next = prev.filter(
        (_calendarFeed, currentIndex) => currentIndex !== index,
      );
      return next.length > 0
        ? next
        : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }];
    });
  };

  const updateGlobalCalendarFeed = (index: number, patch: Partial<CalendarFeed>) => {
    setGlobalCalendarFeeds((prev) =>
      prev.map((calendarFeed, currentIndex) =>
        currentIndex === index ? { ...calendarFeed, ...patch } : calendarFeed,
      ),
    );
  };

  const addGlobalCalendarFeed = () => {
    setGlobalCalendarFeeds((prev) => [
      ...prev,
      {
        url: "",
        color:
          DEFAULT_CALENDAR_COLORS[prev.length % DEFAULT_CALENDAR_COLORS.length],
      },
    ]);
  };

  const removeGlobalCalendarFeed = (index: number) => {
    setGlobalCalendarFeeds((prev) => {
      const next = prev.filter(
        (_calendarFeed, currentIndex) => currentIndex !== index,
      );
      return next.length > 0
        ? next
        : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }];
    });
  };

  const addMediaLink = async ({
    value,
    setValue,
    links,
    setLinks,
    validate,
    setActiveUrl,
    setError,
    errorMessage,
  }: {
    value: string;
    setValue: Dispatch<SetStateAction<string>>;
    links: SavedMediaLink[];
    setLinks: Dispatch<SetStateAction<SavedMediaLink[]>>;
    validate: (url: string) => string | null;
    setActiveUrl: (url: string) => void;
    setError: Dispatch<SetStateAction<string | null>>;
    errorMessage: string;
  }) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setError(null);
      return;
    }

    const normalized = validate(trimmed);
    if (!normalized) {
      setError(errorMessage);
      return;
    }

    const title = await resolveMediaLinkTitle(normalized);
    setLinks((current) =>
      normalizeSavedMediaLinks([
        createSavedMediaLink(normalized, title),
        ...current,
        ...links,
      ]),
    );
    setActiveUrl(normalized);
    setValue("");
    setError(null);
  };

  const removeMediaLink = (
    links: SavedMediaLink[],
    url: string,
    setLinks: Dispatch<SetStateAction<SavedMediaLink[]>>,
    setActiveUrl: (url: string) => void,
  ) => {
    const nextLinks = removeSavedMediaLink(links, url);
    setLinks(nextLinks);
    setActiveUrl(nextLinks[0]?.url ?? '');
  };

  const handleCreatePreset = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      return;
    }

    // Create a minimal layout with only the clock widget visible
    const minimalLayout: WidgetLayoutState = {
      rowCount: 2,
      visibility: {
        clock: true,
        timezoneClock: false,
        weather: false,
        flights: false,
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
        deviceInfo: false,
      },
      placements: {
        clock: { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
        timezoneClock: { column: 2, row: 2, columnSpan: 1, rowSpan: 1 },
        weather: { column: 1, row: 2, columnSpan: 1, rowSpan: 1 },
        flights: { column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
        calendar: { column: 1, row: 3, columnSpan: 1, rowSpan: 1 },
        timer: { column: 1, row: 4, columnSpan: 1, rowSpan: 1 },
        tasks: { column: 2, row: 4, columnSpan: 1, rowSpan: 1 },
        notes: { column: 1, row: 5, columnSpan: 1, rowSpan: 1 },
        spotify: { column: 2, row: 5, columnSpan: 1, rowSpan: 1 },
        appleMusic: { column: 1, row: 6, columnSpan: 1, rowSpan: 1 },
        applePodcast: { column: 2, row: 6, columnSpan: 1, rowSpan: 1 },
        stocks: { column: 1, row: 7, columnSpan: 1, rowSpan: 1 },
        currencies: { column: 2, row: 7, columnSpan: 1, rowSpan: 1 },
        quote: { column: 1, row: 8, columnSpan: 2, rowSpan: 1 },
        deviceInfo: { column: 1, row: 9, columnSpan: 1, rowSpan: 1 },
      },
    };

    savePreset(
      trimmedName,
      DEFAULT_SETTINGS,
      newPresetAutoApply
        ? {
            enabled: true,
            startTime: newPresetStartTime,
            endTime: newPresetEndTime,
          }
        : undefined,
      minimalLayout,
    );
    applyPreset(trimmedName);
    updateSettings(DEFAULT_SETTINGS);
    syncDraftState(DEFAULT_SETTINGS);
    setEditingPresetName(trimmedName);
    refreshPresets();
    setPresetName("");
  };

  const handleApplyPreset = (preset: SettingsPreset) => {
    updateSettings(preset.settings);
    syncDraftState(preset.settings);
    setEditingPresetName(preset.name);
  };

  const handleEditPreset = (preset: SettingsPreset) => {
    applyPreset(preset.name);
    updateSettings(preset.settings);
    syncDraftState(preset.settings);
    setEditingPresetName(preset.name);
    setActiveTab("appearance");
  };

  const handleRenamePreset = (oldName: string, newName: string) => {
    if (editingPresetName === oldName) {
      setEditingPresetName(newName);
    }
  };

  const save = () => {
    const trimmedTimeZone = worldClockTimeZone.trim();
    if (!isValidTimeZone(trimmedTimeZone)) {
      setWorldClockTimeZoneError(
        "Use a valid IANA timezone (for example: Europe/Budapest).",
      );
      return;
    }

    const nextSettings = buildDraftSettings();
    nextSettings.worldClockTimeZone = trimmedTimeZone;
    updateSettings(nextSettings);

    const presetNameToUpdate = editingPresetName.trim()
      || selectedPresetName?.trim()
      || '';
    if (presetNameToUpdate) {
      const preset = presets.find((entry) => entry.name === presetNameToUpdate);
      savePreset(
        presetNameToUpdate,
        nextSettings,
        preset?.schedule,
        buildDraftLayout(),
      );
      refreshPresets();
    }

    onClose();
  };

  return (
    <div className={styles.backdrop}>
      <dialog
        className={styles.dialog}
        aria-label="Settings"
        open
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Close settings"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <aside className={styles.sidebar} aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                className={[
                  styles.sidebarTab,
                  activeTab === tab.id ? styles.sidebarTabActive : "",
                ].join(" ")}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`settings-panel-${tab.id}`}
                type="button"
              >
                <span className={styles.sidebarTabLabel}>{tab.label}</span>
                <span className={styles.sidebarTabDescription}>{tab.description}</span>
              </button>
            ))}
          </aside>

          <div
            className={styles.content}
            id={`settings-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
          >
            {activeTab === "layout" && (
              <>
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Widget Layout</h3>
                  <WidgetLayoutEditor
                    order={order}
                    visibility={visibility}
                    placements={placements}
                    rowCount={rowCount}
                    onSetWidgetPlacement={setWidgetPlacement}
                    onToggleWidget={toggleWidget}
                    onAddRow={addRow}
                    onRemoveRow={removeRow}
                  />
                  <p className={styles.hint}>
                    Drag widgets from the palette onto the grid. Drag the corner to resize. Click × to remove a widget from the dashboard.
                  </p>
                </section>
              </>
            )}

            {activeTab === "appearance" && (
              <>
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Theme</h3>
                  <div className={styles.themeGrid}>
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        className={[
                          styles.themeSwatch,
                          settings.theme === t.id ? styles.themeActive : "",
                        ].join(" ")}
                        onClick={() => updateSettings({ theme: t.id })}
                        aria-pressed={settings.theme === t.id}
                        type="button"
                      >
                        <span className={styles.themeEmoji}>{t.icon}</span>
                        <span className={styles.themeLabel}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {settings.theme === "custom" && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Custom Colors</h3>
                    <div className={styles.colorPickerGrid}>
                      <div className={styles.colorInputGroup}>
                        <label className={styles.colorLabel}>
                          Primary Color
                          <div className={styles.colorInputWrapper}>
                            <input
                              type="color"
                              className={styles.colorInput}
                              value={customColors.primary}
                              onChange={(e) =>
                                setCustomColors({
                                  ...customColors,
                                  primary: e.target.value,
                                })
                              }
                            />
                            <span className={styles.colorValue}>{customColors.primary}</span>
                          </div>
                        </label>
                      </div>
                      <div className={styles.colorInputGroup}>
                        <label className={styles.colorLabel}>
                          Hover Color
                          <div className={styles.colorInputWrapper}>
                            <input
                              type="color"
                              className={styles.colorInput}
                              value={customColors.primaryHover}
                              onChange={(e) =>
                                setCustomColors({
                                  ...customColors,
                                  primaryHover: e.target.value,
                                })
                              }
                            />
                            <span className={styles.colorValue}>{customColors.primaryHover}</span>
                          </div>
                        </label>
                      </div>
                      <div className={[styles.colorInputGroup, styles.backgroundColorGroup].join(" ")}>
                        <div className={styles.colorLabel}>
                          Background
                          <div className={styles.backgroundPreview} style={{ background: customColors.background }} />
                          <div className={styles.segmentedBackground} role="group" aria-label="Background mode">
                            <button
                              type="button"
                              className={[
                                styles.segment,
                                background.mode === "solid" ? styles.segmentActive : "",
                              ].join(" ")}
                              aria-pressed={background.mode === "solid"}
                              onClick={() =>
                                setCustomColors({
                                  ...customColors,
                                  background: background.solid,
                                })
                              }
                            >
                              Solid
                            </button>
                            <button
                              type="button"
                              className={[
                                styles.segment,
                                background.mode === "gradient" ? styles.segmentActive : "",
                              ].join(" ")}
                              aria-pressed={background.mode === "gradient"}
                              onClick={() =>
                                setCustomColors({
                                  ...customColors,
                                  background: formatLinearGradient(
                                    background.gradientAngle,
                                    background.gradientFrom,
                                    background.gradientTo,
                                  ),
                                })
                              }
                            >
                              Gradient
                            </button>
                          </div>

                          {background.mode === "solid" ? (
                            <div className={styles.colorInputWrapper}>
                              <input
                                type="color"
                                className={styles.colorInput}
                                value={background.solid}
                                onChange={(e) =>
                                  setCustomColors({
                                    ...customColors,
                                    background: e.target.value,
                                  })
                                }
                              />
                              <span className={styles.colorValue}>{background.solid}</span>
                            </div>
                          ) : (
                            <div className={styles.backgroundGradientEditor}>
                              <div className={styles.backgroundGradientRow}>
                                <label className={styles.intervalLabel}>
                                  Start Color
                                  <div className={styles.colorInputWrapper}>
                                    <input
                                      type="color"
                                      className={styles.colorInput}
                                      aria-label="Start Color"
                                      value={background.gradientFrom}
                                      onChange={(e) =>
                                        setCustomColors({
                                          ...customColors,
                                          background: formatLinearGradient(
                                            background.gradientAngle,
                                            e.target.value,
                                            background.gradientTo,
                                          ),
                                        })
                                      }
                                    />
                                    <span className={styles.colorValue}>{background.gradientFrom}</span>
                                  </div>
                                </label>
                                <label className={styles.intervalLabel}>
                                  End Color
                                  <div className={styles.colorInputWrapper}>
                                    <input
                                      type="color"
                                      className={styles.colorInput}
                                      aria-label="End Color"
                                      value={background.gradientTo}
                                      onChange={(e) =>
                                        setCustomColors({
                                          ...customColors,
                                          background: formatLinearGradient(
                                            background.gradientAngle,
                                            background.gradientFrom,
                                            e.target.value,
                                          ),
                                        })
                                      }
                                    />
                                    <span className={styles.colorValue}>{background.gradientTo}</span>
                                  </div>
                                </label>
                              </div>

                              <label className={styles.intervalLabel}>
                                Angle
                                <div className={styles.backgroundAngleRow}>
                                  <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="1"
                                    aria-label="Angle slider"
                                    value={background.gradientAngle}
                                    onChange={(e) =>
                                      setCustomColors({
                                        ...customColors,
                                        background: formatLinearGradient(
                                          Number(e.target.value),
                                          background.gradientFrom,
                                          background.gradientTo,
                                        ),
                                      })
                                    }
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="360"
                                    step="1"
                                    className={styles.input}
                                    aria-label="Angle"
                                    value={background.gradientAngle}
                                    onChange={(e) =>
                                      setCustomColors({
                                        ...customColors,
                                        background: formatLinearGradient(
                                          Number(e.target.value),
                                          background.gradientFrom,
                                          background.gradientTo,
                                        ),
                                      })
                                    }
                                  />
                                </div>
                              </label>
                            </div>
                          )}
                          <span className={styles.hint}>Choose a solid color or build a linear gradient.</span>
                        </div>
                      </div>
                      <div className={styles.colorInputGroup}>
                        <label className={styles.colorLabel}>
                          Font Color
                          <div className={styles.colorInputWrapper}>
                            <input
                              type="color"
                              className={styles.colorInput}
                              value={customColors.fontColor}
                              onChange={(e) =>
                                setCustomColors({
                                  ...customColors,
                                  fontColor: e.target.value,
                                })
                              }
                            />
                            <span className={styles.colorValue}>{customColors.fontColor}</span>
                          </div>
                        </label>
                      </div>
                      <div className={styles.colorInputGroup}>
                        <label className={styles.colorLabel}>
                          Secondary Font Color
                          <div className={styles.colorInputWrapper}>
                            <input
                              type="color"
                              className={styles.colorInput}
                              value={customColors.secondaryFontColor}
                              onChange={(e) =>
                                setCustomColors({
                                  ...customColors,
                                  secondaryFontColor: e.target.value,
                                })
                              }
                            />
                            <span className={styles.colorValue}>{customColors.secondaryFontColor}</span>
                          </div>
                        </label>
                      </div>
                    </div>
                    <p className={styles.hint}>
                      Choose your custom accent colors, background, and font colors.
                      They will be applied to buttons, links, interactive elements,
                      and text throughout the app.
                    </p>
                  </section>
                )}

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Appearance</h3>
                  <div className={styles.segmented}>
                    {COLOR_SCHEMES.map((s) => (
                      <button
                        key={s.id}
                        className={[
                          styles.segment,
                          settings.colorScheme === s.id ? styles.segmentActive : "",
                        ].join(" ")}
                        onClick={() => updateSettings({ colorScheme: s.id })}
                        aria-pressed={settings.colorScheme === s.id}
                        type="button"
                      >
                        {s.icon}
                        {s.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Fonts</h3>
                  <div className={styles.fontGrid}>
                    {FONT_PRESET_OPTIONS.map((fontOption) => (
                      <button
                        key={fontOption.id}
                        className={[
                          styles.fontSwatch,
                          settings.fontPreset === fontOption.id
                            ? styles.fontActive
                            : "",
                        ].join(" ")}
                        onClick={() => updateSettings({ fontPreset: fontOption.id })}
                        aria-pressed={settings.fontPreset === fontOption.id}
                        type="button"
                      >
                        <span className={styles.fontIcon}>
                          <Type size={14} />
                        </span>
                        <span
                          className={styles.fontLabel}
                          style={{ fontFamily: fontOption.fontFamily }}
                        >
                          {fontOption.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Support</h3>
                  <div className={styles.widgetGrid}>
                    <button
                      className={[
                        styles.widgetToggle,
                        showBuyMeACoffeeWidget ? styles.widgetVisible : "",
                      ].join(" ")}
                      onClick={() => setShowBuyMeACoffeeWidget((value) => !value)}
                      type="button"
                    >
                      {showBuyMeACoffeeWidget ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                      <span>Show Buy Me a Coffee button</span>
                    </button>
                  </div>
                  <p className={styles.hint}>
                    Hide the floating support button anytime without affecting the
                    rest of your layout.
                  </p>
                </section>
              </>
            )}

            {activeTab === "widgets" && (
              <>
                {!isCalendarOnLayout &&
                  !isWeatherOnLayout &&
                  !isFlightsOnLayout &&
                  !isTimezoneClockOnLayout &&
                  !isFinanceOnLayout &&
                  !isMusicOnLayout &&
                  !isTimerOnLayout && (
                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Widget Settings</h3>
                      <p className={styles.emptyState}>
                        Add widgets to the layout to unlock their widget-specific settings here.
                      </p>
                    </section>
                  )}

                {isCalendarOnLayout && (
                  <>
                    <section className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Global Calendar Feeds</h3>
                        <button
                          className={styles.addCalendarBtn}
                          onClick={addGlobalCalendarFeed}
                          type="button"
                        >
                          <Plus size={14} />
                          Add link
                        </button>
                      </div>
                      <p className={styles.hint}>
                        Global calendar feeds are shared across all presets. Add common calendars here
                        that you want to use in every preset.
                      </p>
                      <div className={styles.calendarList}>
                        {globalCalendarFeeds.map((calendarFeed, index) => (
                          <div
                            className={styles.calendarRow}
                            key={`global-${calendarFeed.url || "new"}-${calendarFeed.color}-${index}`}
                          >
                            <input
                              className={[styles.input, styles.calendarUrlInput].join(" ")}
                              type="url"
                              placeholder={
                                index === 0
                                  ? "https://calendar.example.com/feed.ics"
                                  : "https://outlook.office.com/calendar/.../calendar.ics"
                              }
                              value={calendarFeed.url}
                              onChange={(e) =>
                                updateGlobalCalendarFeed(index, { url: e.target.value })
                              }
                            />
                            <label className={styles.calendarColorField}>
                              <span className={styles.calendarColorLabel}>Color</span>
                              <input
                                aria-label={`Global calendar color ${index + 1}`}
                                className={styles.calendarColorInput}
                                type="color"
                                value={calendarFeed.color}
                                onChange={(e) =>
                                  updateGlobalCalendarFeed(index, { color: e.target.value })
                                }
                              />
                            </label>
                            <button
                              aria-label={`Remove global calendar link ${index + 1}`}
                              className={styles.removeCalendarBtn}
                              onClick={() => removeGlobalCalendarFeed(index)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Preset-Specific Calendar Feeds</h3>
                        <button
                          className={styles.addCalendarBtn}
                          onClick={addCalendarFeed}
                          type="button"
                        >
                          <Plus size={14} />
                          Add link
                        </button>
                      </div>
                      <p className={styles.hint}>
                        Paste one or more ICS or CSV calendar URLs. Google share links,
                        Outlook published calendar links, and webcal:// feeds are
                        supported too. Choose a color for each calendar and its events
                        will use that color in the calendar widget. These feeds will be combined with
                        your global calendar feeds.
                      </p>
                      <div className={styles.calendarList}>
                        {calendarFeeds.map((calendarFeed, index) => (
                          <div
                            className={styles.calendarRow}
                            key={`${calendarFeed.url || "new"}-${calendarFeed.color}-${index}`}
                          >
                            <input
                              className={[styles.input, styles.calendarUrlInput].join(" ")}
                              type="url"
                              placeholder={
                                index === 0
                                  ? "https://calendar.example.com/feed.ics"
                                  : "https://outlook.office.com/calendar/.../calendar.ics"
                              }
                              value={calendarFeed.url}
                              onChange={(e) =>
                                updateCalendarFeed(index, { url: e.target.value })
                              }
                            />
                            <label className={styles.calendarColorField}>
                              <span className={styles.calendarColorLabel}>Color</span>
                              <input
                                aria-label={`Calendar color ${index + 1}`}
                                className={styles.calendarColorInput}
                                type="color"
                                value={calendarFeed.color}
                                onChange={(e) =>
                                  updateCalendarFeed(index, { color: e.target.value })
                                }
                              />
                            </label>
                            <button
                              aria-label={`Remove calendar link ${index + 1}`}
                              className={styles.removeCalendarBtn}
                              onClick={() => removeCalendarFeed(index)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Calendar Display</h3>
                      <div className={styles.segmented}>
                        {CALENDAR_WEEK_STARTS.map((option) => (
                          <button
                            key={option.id}
                            className={[
                              styles.segment,
                              calendarWeekStartsOn === option.id ? styles.segmentActive : "",
                            ].join(" ")}
                            onClick={() => setCalendarWeekStartsOn(option.id)}
                            aria-pressed={calendarWeekStartsOn === option.id}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className={styles.widgetGrid}>
                        <button
                          className={[
                            styles.widgetToggle,
                            !calendarHidePastEvents ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setCalendarHidePastEvents((value) => !value)}
                          type="button"
                          aria-pressed={!calendarHidePastEvents}
                        >
                          {!calendarHidePastEvents ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show past events</span>
                        </button>
                        <button
                          className={[
                            styles.widgetToggle,
                            calendarShowAllDayEvents ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setCalendarShowAllDayEvents((value) => !value)}
                          type="button"
                        >
                          {calendarShowAllDayEvents ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show all-day events</span>
                        </button>
                        <button
                          className={[
                            styles.widgetToggle,
                            calendarShowMonthlyOverview ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() =>
                            setCalendarShowMonthlyOverview((value) => !value)
                          }
                          type="button"
                        >
                          {calendarShowMonthlyOverview ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show calendar extra info</span>
                        </button>
                      </div>
                      {calendarShowMonthlyOverview && (
                        <div className={styles.segmented}>
                          {CALENDAR_EXTRA_INFO_PREVIEW_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              className={[
                                styles.segment,
                                calendarExtraInfoPreview === option.id ? styles.segmentActive : "",
                              ].join(" ")}
                              onClick={() => setCalendarExtraInfoPreview(option.id)}
                              aria-pressed={calendarExtraInfoPreview === option.id}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}

                {isWeatherOnLayout && (
                  <>
                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Weather Display</h3>
                      <div className={styles.segmented}>
                        {WEATHER_UNITS.map((unit) => (
                          <button
                            key={unit.id}
                            className={[
                              styles.segment,
                              weatherUnitSystem === unit.id ? styles.segmentActive : "",
                            ].join(" ")}
                            onClick={() => setWeatherUnitSystem(unit.id)}
                            aria-pressed={weatherUnitSystem === unit.id}
                            type="button"
                          >
                            {unit.label}
                          </button>
                        ))}
                      </div>
                      <div className={styles.widgetGrid}>
                        <button
                          className={[
                            styles.widgetToggle,
                            weatherShowExtraDetails ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setWeatherShowExtraDetails((value) => !value)}
                          type="button"
                        >
                          {weatherShowExtraDetails ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show extra weather details</span>
                        </button>
                      </div>
                    </section>

                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Weather Refresh</h3>
                      <div className={styles.intervalRow}>
                        <label className={styles.intervalLabel}>
                          <span>Refresh every (min)</span>
                          <input
                            className={styles.numberInput}
                            type="number"
                            min={1}
                            max={180}
                            value={weatherRefreshMin}
                            onChange={(e) =>
                              setWeatherRefreshMin(
                                Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                              )
                            }
                          />
                        </label>
                      </div>
                      <p className={styles.hint}>
                        Weather updates automatically using this interval. You can still
                        refresh it manually anytime.
                      </p>
                    </section>
                  </>
                )}

                {isFlightsOnLayout && (
                  <>
                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Flights Radar</h3>
                      <div className={styles.intervalRow}>
                        <label className={styles.intervalLabel}>
                          <span>Radar range (km)</span>
                          <input
                            className={styles.numberInput}
                            type="number"
                            min={5}
                            max={250}
                            value={flightsRadarRadiusKm}
                            onChange={(e) =>
                              setFlightsRadarRadiusKm(
                                Math.min(250, Math.max(5, Number.parseInt(e.target.value, 10) || 5)),
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.widgetGrid}>
                        <button
                          className={[
                            styles.widgetToggle,
                            flightsUseDeviceLocation ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setFlightsUseDeviceLocation((value) => !value)}
                          type="button"
                        >
                          {flightsUseDeviceLocation ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Use device location</span>
                        </button>
                        <button
                          className={[
                            styles.widgetToggle,
                            flightsShowOnlyAirborne ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setFlightsShowOnlyAirborne((value) => !value)}
                          type="button"
                        >
                          {flightsShowOnlyAirborne ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show only airborne flights</span>
                        </button>
                        <button
                          className={[
                            styles.widgetToggle,
                            flightsShowLabels ? styles.widgetVisible : "",
                          ].join(" ")}
                          onClick={() => setFlightsShowLabels((value) => !value)}
                          type="button"
                        >
                          {flightsShowLabels ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Show labels on radar</span>
                        </button>
                      </div>
                      <p className={styles.hint}>
                        The flights widget tracks nearby aircraft around your current position.
                        Save manual coordinates to use it indoors or as a fallback when
                        geolocation is unavailable.
                      </p>
                    </section>

                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Flight Scan</h3>
                      <div className={styles.intervalRow}>
                        <label className={styles.intervalLabel}>
                          <span>Radius (km)</span>
                          <input
                            className={styles.numberInput}
                            type="number"
                            min={5}
                            max={250}
                            value={flightsRadiusKm}
                            onChange={(e) =>
                              setFlightsRadiusKm(
                                Math.min(250, Math.max(5, Number.parseInt(e.target.value, 10) || 5)),
                              )
                            }
                          />
                        </label>
                        <label className={styles.intervalLabel}>
                          <span>Refresh every (sec)</span>
                          <input
                            className={styles.numberInput}
                            type="number"
                            min={2}
                            max={3600}
                            value={flightsRefreshSeconds}
                            onChange={(e) =>
                              setFlightsRefreshSeconds(
                                Math.min(3600, Math.max(2, Number.parseInt(e.target.value, 10) || 2)),
                              )
                            }
                          />
                        </label>
                      </div>
                    </section>

                    <section className={styles.section}>
                      <h3 className={styles.sectionTitle}>Manual Coordinates</h3>
                      <div className={styles.calendarList}>
                        <label className={styles.intervalLabel}>
                          <span>Latitude</span>
                          <input
                            className={styles.input}
                            type="text"
                            inputMode="decimal"
                            value={flightsManualLatitude}
                            placeholder="47.4979"
                            onChange={(e) => setFlightsManualLatitude(e.target.value)}
                          />
                        </label>
                        <label className={styles.intervalLabel}>
                          <span>Longitude</span>
                          <input
                            className={styles.input}
                            type="text"
                            inputMode="decimal"
                            value={flightsManualLongitude}
                            placeholder="19.0402"
                            onChange={(e) => setFlightsManualLongitude(e.target.value)}
                          />
                        </label>
                      </div>
                      <p className={styles.hint}>
                        Latitude must be between -90 and 90, longitude between -180 and 180.
                        These coordinates are used whenever device location is turned off and as a
                        fallback when browser location access is blocked.
                      </p>
                    </section>
                  </>
                )}

                {isTimezoneClockOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Timezone Clock</h3>
                    <div className={styles.calendarList}>
                      <label className={styles.intervalLabel}>
                        <span>City name</span>
                        <input
                          className={styles.input}
                          type="text"
                          value={worldClockCity}
                          placeholder="New York"
                          onChange={(e) => setWorldClockCity(e.target.value)}
                        />
                      </label>
                      <label className={styles.intervalLabel}>
                        <span>Timezone (IANA)</span>
                        <input
                          className={styles.input}
                          type="text"
                          value={worldClockTimeZone}
                          placeholder="America/New_York"
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setWorldClockTimeZone(nextValue);
                            const trimmedValue = nextValue.trim();
                            setWorldClockTimeZoneError(
                              trimmedValue.length === 0 || isValidTimeZone(trimmedValue)
                                ? null
                                : "Use a valid IANA timezone (for example: Europe/Budapest).",
                            );
                          }}
                        />
                      </label>
                      {worldClockTimeZoneError && (
                        <p className={styles.mediaLinkError}>{worldClockTimeZoneError}</p>
                      )}
                    </div>
                    <p className={styles.hint}>
                      This widget always shows your local time next to your selected city.
                    </p>
                  </section>
                )}

                {isFinanceOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Finance Widgets</h3>

                    <div className={styles.intervalRow}>
                      <label className={styles.intervalLabel}>
                        <span>Refresh every (minutes)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={1440}
                          value={financeRefreshMin}
                          onChange={(e) =>
                            setFinanceRefreshMin(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                          }
                        />
                      </label>
                    </div>

                    <p className={styles.listHeading}>Stock symbols</p>
                    {stockSymbols.map((sym) => (
                      <div key={sym} className={styles.calendarRow}>
                        <span className={[styles.input, styles.calendarUrlInput, styles.readonlyPill].join(" ")}>{sym}</span>
                        <button
                          type="button"
                          className={styles.removeCalendarBtn}
                          onClick={() => setStockSymbols((prev) => prev.filter((s) => s !== sym))}
                          aria-label={`Remove ${sym}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className={styles.calendarRow}>
                      <input
                        className={[styles.input, styles.calendarUrlInput].join(" ")}
                        type="text"
                        maxLength={12}
                        value={stockAddInput}
                        onChange={(e) => setStockAddInput(e.target.value.toUpperCase())}
                        placeholder="e.g. TSLA"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const sym = stockAddInput.trim().toUpperCase();
                            if (sym && !stockSymbols.includes(sym)) {
                              setStockSymbols((prev) => [...prev, sym]);
                            }
                            setStockAddInput("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={styles.addCalendarBtn}
                        onClick={() => {
                          const sym = stockAddInput.trim().toUpperCase();
                          if (sym && !stockSymbols.includes(sym)) {
                            setStockSymbols((prev) => [...prev, sym]);
                          }
                          setStockAddInput("");
                        }}
                      >
                        Add
                      </button>
                    </div>

                    <p className={styles.listHeading}>Currency pairs</p>
                    {currencyPairs.map(([base, target]) => (
                      <div key={`${base}/${target}`} className={styles.calendarRow}>
                        <span className={[styles.input, styles.calendarUrlInput, styles.readonlyPill].join(" ")}>{base} → {target}</span>
                        <button
                          type="button"
                          className={styles.removeCalendarBtn}
                          onClick={() =>
                            setCurrencyPairs((prev) =>
                              prev.filter(([b, t]) => !(b === base && t === target)),
                            )
                          }
                          aria-label={`Remove ${base}/${target}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className={styles.calendarRow}>
                      <input
                        className={styles.input}
                        type="text"
                        maxLength={3}
                        value={currencyAddBase}
                        onChange={(e) => setCurrencyAddBase(e.target.value.toUpperCase())}
                        placeholder="USD"
                      />
                      <span className={styles.currencyArrow}>→</span>
                      <input
                        className={styles.input}
                        type="text"
                        maxLength={3}
                        value={currencyAddTarget}
                        onChange={(e) => setCurrencyAddTarget(e.target.value.toUpperCase())}
                        placeholder="EUR"
                      />
                      <button
                        type="button"
                        className={styles.addCalendarBtn}
                        onClick={() => {
                          const base = currencyAddBase.trim().toUpperCase();
                          const target = currencyAddTarget.trim().toUpperCase();
                          if (
                            /^[A-Z]{3}$/.test(base) &&
                            /^[A-Z]{3}$/.test(target) &&
                            !currencyPairs.some(([b, t]) => b === base && t === target)
                          ) {
                            setCurrencyPairs((prev) => [...prev, [base, target]]);
                            setCurrencyAddBase("");
                            setCurrencyAddTarget("");
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>

                    <p className={styles.hint}>
                      Data refreshes automatically at the selected interval. You can still refresh manually.
                    </p>
                  </section>
                )}

                {isMusicOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Music Embeds</h3>
                    {isSpotifyOnLayout && (
                      <MediaLinkEditor
                        title="Spotify"
                        brand="spotify"
                        activeUrl={spotifyEmbedUrl}
                        savedLinks={spotifyEmbedLinks}
                        addUrl={spotifyAddUrl}
                        addPlaceholder="https://open.spotify.com/track/..."
                        onSelectUrl={(url) => {
                          setSpotifyEmbedUrl(url);
                          setSpotifyLinkError(null);
                        }}
                        onRemoveSelected={() =>
                          removeMediaLink(
                            spotifyEmbedLinks,
                            spotifyEmbedUrl,
                            setSpotifyEmbedLinks,
                            setSpotifyEmbedUrl,
                          )
                        }
                        onAddUrlChange={setSpotifyAddUrl}
                        onAddLink={() =>
                          void addMediaLink({
                            value: spotifyAddUrl,
                            setValue: setSpotifyAddUrl,
                            links: spotifyEmbedLinks,
                            setLinks: setSpotifyEmbedLinks,
                            validate: normalizeSpotifyEmbedUrl,
                            setActiveUrl: setSpotifyEmbedUrl,
                            setError: setSpotifyLinkError,
                            errorMessage: "Please paste a valid Spotify track, album, playlist, artist, show or episode link.",
                          })
                        }
                        error={spotifyLinkError}
                      />
                    )}
                    {isAppleMusicOnLayout && (
                      <MediaLinkEditor
                        title="Apple Music"
                        brand="apple-music"
                        activeUrl={appleMusicEmbedUrl}
                        savedLinks={appleMusicEmbedLinks}
                        addUrl={appleMusicAddUrl}
                        addPlaceholder="https://music.apple.com/..."
                        onSelectUrl={(url) => {
                          setAppleMusicEmbedUrl(url);
                          setAppleMusicLinkError(null);
                        }}
                        onRemoveSelected={() =>
                          removeMediaLink(
                            appleMusicEmbedLinks,
                            appleMusicEmbedUrl,
                            setAppleMusicEmbedLinks,
                            setAppleMusicEmbedUrl,
                          )
                        }
                        onAddUrlChange={setAppleMusicAddUrl}
                        onAddLink={() =>
                          void addMediaLink({
                            value: appleMusicAddUrl,
                            setValue: setAppleMusicAddUrl,
                            links: appleMusicEmbedLinks,
                            setLinks: setAppleMusicEmbedLinks,
                            validate: normalizeAppleMusicEmbedUrl,
                            setActiveUrl: setAppleMusicEmbedUrl,
                            setError: setAppleMusicLinkError,
                            errorMessage: "Please paste a valid Apple Music album, playlist, song, or artist link.",
                          })
                        }
                        error={appleMusicLinkError}
                      />
                    )}
                    {isApplePodcastOnLayout && (
                      <MediaLinkEditor
                        title="Apple Podcast"
                        brand="apple-podcasts"
                        activeUrl={applePodcastEmbedUrl}
                        savedLinks={applePodcastEmbedLinks}
                        addUrl={applePodcastAddUrl}
                        addPlaceholder="https://podcasts.apple.com/..."
                        onSelectUrl={(url) => {
                          setApplePodcastEmbedUrl(url);
                          setApplePodcastLinkError(null);
                        }}
                        onRemoveSelected={() =>
                          removeMediaLink(
                            applePodcastEmbedLinks,
                            applePodcastEmbedUrl,
                            setApplePodcastEmbedLinks,
                            setApplePodcastEmbedUrl,
                          )
                        }
                        onAddUrlChange={setApplePodcastAddUrl}
                        onAddLink={() =>
                          void addMediaLink({
                            value: applePodcastAddUrl,
                            setValue: setApplePodcastAddUrl,
                            links: applePodcastEmbedLinks,
                            setLinks: setApplePodcastEmbedLinks,
                            validate: normalizeApplePodcastEmbedUrl,
                            setActiveUrl: setApplePodcastEmbedUrl,
                            setError: setApplePodcastLinkError,
                            errorMessage: "Please paste a valid Apple Podcast show or episode link.",
                          })
                        }
                        error={applePodcastLinkError}
                      />
                    )}
                    <p className={styles.hint}>
                      Paste a public share link. Dayboard converts it to an embeddable player automatically.
                    </p>
                  </section>
                )}

                {isTimerOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Pomodoro Intervals</h3>
                    <div className={styles.intervalRow}>
                      <label className={styles.intervalLabel}>
                        <span>Work (min)</span>
                        <input
                          className={styles.numberInput}
                          type="number"
                          min={1}
                          max={120}
                          value={workMin}
                          onChange={(e) =>
                            setWorkMin(
                              Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            )
                          }
                        />
                      </label>
                      <label className={styles.intervalLabel}>
                        <span>Break (min)</span>
                        <input
                          className={styles.numberInput}
                          type="number"
                          min={1}
                          max={60}
                          value={breakMin}
                          onChange={(e) =>
                            setBreakMin(
                              Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === "presets" && (
              <>
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h3 className={styles.sectionTitle}>Create Preset</h3>
                      <p className={styles.hint}>
                        Save the current setup as a preset like Work Focus, Deep Work, or Wind Down.
                      </p>
                    </div>
                  </div>
                  <div className={styles.presetCreateCard}>
                    <label className={styles.intervalLabel}>
                      <span>Preset name</span>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Work Focus"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                      />
                    </label>
                    <div className={styles.presetCreateSchedule}>
                      <button
                        className={[
                          styles.widgetToggle,
                          newPresetAutoApply ? styles.widgetVisible : "",
                        ].join(" ")}
                        onClick={() => setNewPresetAutoApply((value) => !value)}
                        type="button"
                        aria-pressed={newPresetAutoApply}
                      >
                        {newPresetAutoApply ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{newPresetAutoApply ? "Auto-apply on" : "Auto-apply off"}</span>
                      </button>
                      {newPresetAutoApply && (
                        <div className={styles.presetScheduleInputs}>
                          <label className={styles.intervalLabel}>
                            <span>Start</span>
                            <input
                              className={styles.input}
                              type="time"
                              value={newPresetStartTime}
                              onChange={(e) => setNewPresetStartTime(e.target.value)}
                            />
                          </label>
                          <label className={styles.intervalLabel}>
                            <span>End</span>
                            <input
                              className={styles.input}
                              type="time"
                              value={newPresetEndTime}
                              onChange={(e) => setNewPresetEndTime(e.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className={styles.presetCreateActions}>
                      <button className={styles.btnPrimary} onClick={handleCreatePreset} type="button">
                        Save preset
                      </button>
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Saved Presets</h3>
                    <span className={styles.hint}>
                      {activePresetName ? `Currently active: ${activePresetName}` : "No preset is scheduled right now."}
                    </span>
                  </div>
                  {presets.length === 0 ? (
                    <p className={styles.emptyState}>
                      No presets yet. Save your current setup to switch between routines in one click.
                    </p>
                  ) : (
                    <div className={styles.presetList}>
                      {presets.map((preset) => (
                        <PresetCard
                          key={preset.name}
                          preset={preset}
                          draftSettings={buildDraftSettings()}
                          draftLayout={buildDraftLayout()}
                          isActive={activePresetName === preset.name}
                          onRefresh={refreshPresets}
                          onApply={handleApplyPreset}
                          onEdit={handleEditPreset}
                          onRename={handleRenamePreset}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={save} type="button">
            Save
          </button>
        </div>
      </dialog>
    </div>
  );
}
