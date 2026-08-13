import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
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
  SPORTS_LEAGUE_OPTIONS,
  applyPreset,
  deletePreset,
  isPresetScheduledNow,
  listPresets,
  renamePreset,
  savePreset,
  type Settings,
  type SettingsPreset,
  type SettingsPresetSchedule,
  type SportsFavoriteTeam,
  type SportsLeagueId,
  updatePresetSchedule,
  type CalendarFeed,
  type CalendarExtraInfoPreview,
  type CalendarWeekStartsOn,
  type Theme,
  type ColorScheme,
  type CustomColors,
  type WeatherUnitSystem,
} from "../lib/settings";
import { searchSportsTeams, type SportsTeamSearchResult } from "../lib/sports";
import {
  buildGoogleCalendarFeedUrl,
  clearStoredGoogleAuth,
  fetchGoogleCalendarList,
  getStoredGoogleAuth,
  parseGoogleCalendarFeedUrl,
  startGoogleLogin,
  type GoogleAuthSession,
  type GoogleCalendarListEntry,
} from "../lib/googleAuth";
import {
  clearStoredSpotifyAuth,
  consumeSpotifyAuthNotice,
  getStoredSpotifyAuth,
  startSpotifyLogin,
  type SpotifyAuthNotice,
  type SpotifyAuthSession,
} from "../lib/spotifyAuth";
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

function formatOptionalFontSizeRem(value: number | null): string {
  return value == null ? "" : String(value)
}

function parseOptionalFontSizeRem(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(40, Math.max(0.5, Math.round(parsed * 10) / 10))
}

function formatOptionalStretchPercent(value: number | null): string {
  return value == null ? "" : String(value)
}

function parseOptionalStretchPercent(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(200, Math.max(50, Math.round(parsed)))
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
  id: "core" | "productivity" | "media" | "finance" | "sports";
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

  // Google Calendar auth state
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthSession | null>(() => getStoredGoogleAuth())
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarListEntry[]>([])
  const [googleCalendarsLoading, setGoogleCalendarsLoading] = useState(false)
  const [googleCalendarsError, setGoogleCalendarsError] = useState<string | null>(null)
  const [spotifyAuth, setSpotifyAuth] = useState<SpotifyAuthSession | null>(() => getStoredSpotifyAuth())
  const [spotifyAuthNotice, setSpotifyAuthNotice] = useState<SpotifyAuthNotice | null>(() =>
    consumeSpotifyAuthNotice(),
  )
  const [spotifyAuthLoading, setSpotifyAuthLoading] = useState(false)

  useEffect(() => {
    if (!googleAuth) {
      setGoogleCalendars([])
      return
    }

    setGoogleCalendarsLoading(true)
    setGoogleCalendarsError(null)

    void fetchGoogleCalendarList(googleAuth).then((calendars) => {
      setGoogleCalendars(calendars)
      setGoogleCalendarsLoading(false)
    }).catch((error: unknown) => {
      setGoogleCalendarsError(error instanceof Error ? error.message : 'Failed to load calendars.')
      setGoogleCalendarsLoading(false)
    })
  }, [googleAuth])

  function isGoogleCalendarAdded(calendarId: string, feeds: CalendarFeed[]): boolean {
    const url = buildGoogleCalendarFeedUrl(calendarId)
    return feeds.some((feed) => feed.url === url)
  }

  function addGoogleCalendar(calendar: GoogleCalendarListEntry) {
    const url = buildGoogleCalendarFeedUrl(calendar.id)
    const color = calendar.backgroundColor
    setGlobalCalendarFeeds((prev) => {
      if (prev.some((feed) => feed.url === url)) return prev
      return [...prev.filter((feed) => feed.url !== ''), { url, color }]
    })
  }

  function removeGoogleCalendar(calendarId: string) {
    const url = buildGoogleCalendarFeedUrl(calendarId)
    setGlobalCalendarFeeds((prev) => prev.filter((feed) => feed.url !== url))
    setCalendarFeeds((prev) => prev.filter((feed) => feed.url !== url))
  }

  function handleDisconnectGoogle() {
    clearStoredGoogleAuth()
    setGoogleAuth(null)
    // Remove all Google Calendar feeds
    setGlobalCalendarFeeds((prev) => prev.filter((feed) => parseGoogleCalendarFeedUrl(feed.url) === null))
    setCalendarFeeds((prev) => prev.filter((feed) => parseGoogleCalendarFeedUrl(feed.url) === null))
  }

  function handleConnectSpotify() {
    setSpotifyAuthNotice(null)
    setSpotifyAuthLoading(true)

    void startSpotifyLogin().catch((error: unknown) => {
      setSpotifyAuthLoading(false)
      setSpotifyAuthNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Spotify login failed.",
      })
      console.error("Spotify login failed:", error)
    })
  }

  function handleDisconnectSpotify() {
    clearStoredSpotifyAuth()
    setSpotifyAuth(null)
    setSpotifyAuthLoading(false)
    setSpotifyAuthNotice(null)
  }
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
  const [clockTimeFontSize, setClockTimeFontSize] = useState(
    formatOptionalFontSizeRem(settings.clockTimeFontSizeRem),
  );
  const [clockDateFontSize, setClockDateFontSize] = useState(
    formatOptionalFontSizeRem(settings.clockDateFontSizeRem),
  );
  const [clockTimeStretch, setClockTimeStretch] = useState(
    formatOptionalStretchPercent(settings.clockTimeStretchPercent),
  );
  const [worldClockTimeZoneError, setWorldClockTimeZoneError] = useState<
    string | null
  >(null);
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
  const [sportsFavoriteTeams, setSportsFavoriteTeams] = useState<SportsFavoriteTeam[]>(
    settings.sportsFavoriteTeams,
  );
  const sportsFavoriteTeamsRef = useRef<SportsFavoriteTeam[]>(settings.sportsFavoriteTeams);
  const [sportsEnabledLeagues, setSportsEnabledLeagues] = useState<SportsLeagueId[]>(
    settings.sportsEnabledLeagues,
  );
  const [sportsFollowedLeagues, setSportsFollowedLeagues] = useState<SportsLeagueId[]>(
    settings.sportsFollowedLeagues,
  );
  const [sportsRefreshMin, setSportsRefreshMin] = useState(settings.sportsRefreshMinutes);
  const [sportsTeamQuery, setSportsTeamQuery] = useState("");
  const [debouncedSportsTeamQuery, setDebouncedSportsTeamQuery] = useState("");
  const [sportsTeamSearchResults, setSportsTeamSearchResults] = useState<SportsTeamSearchResult[]>(
    [],
  );
  const [sportsTeamSearchLoading, setSportsTeamSearchLoading] = useState(false);
  const [sportsTeamSearchError, setSportsTeamSearchError] = useState<string | null>(null);
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
  const isClockOnLayout = visibility.clock;
  const isTimezoneClockOnLayout = visibility.timezoneClock;
  const isFinanceOnLayout = visibility.stocks || visibility.currencies;
  const isSportsOnLayout = visibility.sports;
  const isMusicOnLayout =
    visibility.spotify ||
    visibility.appleMusic ||
    visibility.applePodcast;
  const isSpotifyOnLayout = visibility.spotify;
  const isAppleMusicOnLayout = visibility.appleMusic;
  const isApplePodcastOnLayout = visibility.applePodcast;
  const isTimerOnLayout = visibility.timer;
  const activePresetName = presets.find((preset) => isPresetScheduledNow(preset.schedule))?.name ?? null;
  const sportsFavoriteTeamsByLeague = useMemo(() => {
    const grouped = new Map<string, SportsFavoriteTeam[]>()
    sportsFavoriteTeams.forEach((team) => {
      const current = grouped.get(team.leagueName) ?? []
      current.push(team)
      grouped.set(team.leagueName, current)
    })

    return [...grouped.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    )
  }, [sportsFavoriteTeams]);
  const sortedSportsSearchResults = useMemo(() => {
    return [...sportsTeamSearchResults].sort((left, right) => {
      const leagueOrder = left.leagueName.localeCompare(right.leagueName)
      if (leagueOrder !== 0) {
        return leagueOrder
      }
      return left.name.localeCompare(right.name)
    })
  }, [sportsTeamSearchResults]);

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
    setClockTimeFontSize(formatOptionalFontSizeRem(nextSettings.clockTimeFontSizeRem));
    setClockDateFontSize(formatOptionalFontSizeRem(nextSettings.clockDateFontSizeRem));
    setClockTimeStretch(formatOptionalStretchPercent(nextSettings.clockTimeStretchPercent));
    setWorldClockCity(nextSettings.worldClockCity);
    setWorldClockTimeZone(nextSettings.worldClockTimeZone);
    setWorldClockTimeZoneError(null);
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
    setSportsFavoriteTeams(nextSettings.sportsFavoriteTeams);
    sportsFavoriteTeamsRef.current = nextSettings.sportsFavoriteTeams;
    setSportsEnabledLeagues(nextSettings.sportsEnabledLeagues);
    setSportsFollowedLeagues(nextSettings.sportsFollowedLeagues);
    setSportsRefreshMin(nextSettings.sportsRefreshMinutes);
    setSportsTeamQuery("");
    setDebouncedSportsTeamQuery("");
    setSportsTeamSearchResults([]);
    setSportsTeamSearchLoading(false);
    setSportsTeamSearchError(null);
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
    clockTimeFontSizeRem: parseOptionalFontSizeRem(clockTimeFontSize),
    clockDateFontSizeRem: parseOptionalFontSizeRem(clockDateFontSize),
    clockTimeStretchPercent: parseOptionalStretchPercent(clockTimeStretch),
    worldClockCity: worldClockCity.trim() || settings.worldClockCity,
    worldClockTimeZone: worldClockTimeZone.trim() || settings.worldClockTimeZone,
    spotifyEmbedUrl: settings.spotifyEmbedUrl,
    spotifyEmbedLinks: settings.spotifyEmbedLinks,
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
    sportsFavoriteTeams: sportsFavoriteTeamsRef.current,
    sportsEnabledLeagues,
    sportsFollowedLeagues,
    sportsRefreshMinutes: sportsRefreshMin,
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
    const nextClockTimeFontSizeRem = parseOptionalFontSizeRem(clockTimeFontSize);
    const nextClockDateFontSizeRem = parseOptionalFontSizeRem(clockDateFontSize);
    const nextClockTimeStretchPercent = parseOptionalStretchPercent(clockTimeStretch);

    if (
      settings.clockTimeFontSizeRem === nextClockTimeFontSizeRem
      && settings.clockDateFontSizeRem === nextClockDateFontSizeRem
      && settings.clockTimeStretchPercent === nextClockTimeStretchPercent
    ) {
      return;
    }

    updateSettings({
      clockTimeFontSizeRem: nextClockTimeFontSizeRem,
      clockDateFontSizeRem: nextClockDateFontSizeRem,
      clockTimeStretchPercent: nextClockTimeStretchPercent,
    });
  }, [
    clockDateFontSize,
    clockTimeFontSize,
    clockTimeStretch,
    settings.clockDateFontSizeRem,
    settings.clockTimeFontSizeRem,
    settings.clockTimeStretchPercent,
    updateSettings,
  ]);

  useEffect(() => {
    if (selectedPresetName) {
      setEditingPresetName(selectedPresetName);
    }
  }, [selectedPresetName]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSportsTeamQuery(sportsTeamQuery);
    }, 500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [sportsTeamQuery]);

  useEffect(() => {
    if (!isSportsOnLayout || activeTab !== "widgets") {
      setSportsTeamSearchResults([]);
      setSportsTeamSearchLoading(false);
      setSportsTeamSearchError(null);
      return;
    }

    const query = debouncedSportsTeamQuery.trim();
    if (query.length < 2) {
      setSportsTeamSearchResults([]);
      setSportsTeamSearchLoading(false);
      setSportsTeamSearchError(null);
      return;
    }

    let cancelled = false;
    setSportsTeamSearchLoading(true);
    setSportsTeamSearchError(null);

    searchSportsTeams(query, sportsEnabledLeagues)
      .then((teams) => {
        if (cancelled) {
          return;
        }
        setSportsTeamSearchResults(teams);
        setSportsTeamSearchLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setSportsTeamSearchError(error instanceof Error ? error.message : "Could not load teams.");
        setSportsTeamSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedSportsTeamQuery, isSportsOnLayout, sportsEnabledLeagues]);

  const toggleSportsLeague = (leagueId: SportsLeagueId) => {
    setSportsEnabledLeagues((previous) => {
      if (previous.includes(leagueId)) {
        const next = previous.filter((entry) => entry !== leagueId);
        return next.length > 0 ? next : previous;
      }
      return [...previous, leagueId];
    });
  };

  const toggleSportsFollowedLeague = (leagueId: SportsLeagueId) => {
    setSportsFollowedLeagues((previous) => {
      let next: SportsLeagueId[]
      if (previous.includes(leagueId)) {
        next = previous.filter((entry) => entry !== leagueId)
      } else {
        next = [...previous, leagueId]
      }

      if (next !== previous) {
        updateSettings({ sportsFollowedLeagues: next })
      }
      return next
    })
  }

  const addFavoriteTeam = (team: SportsTeamSearchResult) => {
    const alreadyExists = sportsFavoriteTeamsRef.current.some(
      (candidate) => candidate.id === team.id && candidate.leagueId === team.leagueId,
    );
    if (alreadyExists) {
      return;
    }

    const nextTeams = [...sportsFavoriteTeamsRef.current, team];
    sportsFavoriteTeamsRef.current = nextTeams;
    setSportsFavoriteTeams(nextTeams);
    updateSettings({ sportsFavoriteTeams: nextTeams });
  };

  const removeFavoriteTeam = (teamToRemove: SportsFavoriteTeam) => {
    const nextTeams = sportsFavoriteTeamsRef.current.filter(
      (team) => !(team.id === teamToRemove.id && team.leagueId === teamToRemove.leagueId),
    );
    sportsFavoriteTeamsRef.current = nextTeams;
    setSportsFavoriteTeams(nextTeams);
    updateSettings({ sportsFavoriteTeams: nextTeams });
  };

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
    const presetSettings = buildDraftSettings();
    const presetLayout = buildDraftLayout();

    savePreset(
      trimmedName,
      presetSettings,
      newPresetAutoApply
        ? {
            enabled: true,
            startTime: newPresetStartTime,
            endTime: newPresetEndTime,
          }
        : undefined,
      presetLayout,
    );
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

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: SettingsTabId,
  ) => {
    const index = SETTINGS_TABS.findIndex((tab) => tab.id === tabId);

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveTab(SETTINGS_TABS[(index + 1) % SETTINGS_TABS.length].id);
      return;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveTab(SETTINGS_TABS[(index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length].id);
      return;
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveTab(SETTINGS_TABS[0].id);
      return;
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveTab(SETTINGS_TABS[SETTINGS_TABS.length - 1].id);
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
          <aside className={styles.sidebar} aria-label="Settings sections" role="tablist">
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
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
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
                  !isSportsOnLayout &&
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
                        <h3 className={styles.sectionTitle}>Google Calendar</h3>
                        {googleAuth ? (
                          <button
                            className={styles.removeCalendarBtn}
                            onClick={handleDisconnectGoogle}
                            type="button"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            className={styles.googleConnectBtn}
                            onClick={() => {
                              void startGoogleLogin().then((auth) => {
                                setGoogleAuth(auth)
                              }).catch((error: unknown) => {
                                console.error('Google login failed:', error)
                              })
                            }}
                            type="button"
                          >
                            <svg className={styles.googleLogo} viewBox="0 0 24 24" aria-hidden="true">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                          </button>
                        )}
                      </div>
                      {!googleAuth && (
                        <p className={styles.hint}>
                          Connect your Google account to import calendars directly from Google Calendar.
                          You can also add ICS/webcal links manually below.
                        </p>
                      )}
                      {googleAuth && googleCalendarsLoading && (
                        <p className={styles.hint}>Loading your calendars…</p>
                      )}
                      {googleAuth && googleCalendarsError && (
                        <p className={styles.hint} style={{ color: 'var(--color-error, #ef4444)' }}>
                          {googleCalendarsError}
                        </p>
                      )}
                      {googleAuth && !googleCalendarsLoading && googleCalendars.length > 0 && (
                        <div className={styles.googleCalendarList}>
                          {googleCalendars.map((calendar) => {
                            const added = isGoogleCalendarAdded(calendar.id, globalCalendarFeeds) ||
                              isGoogleCalendarAdded(calendar.id, calendarFeeds)
                            return (
                              <div key={calendar.id} className={styles.googleCalendarRow}>
                                <span
                                  className={styles.googleCalendarDot}
                                  style={{ background: calendar.backgroundColor }}
                                />
                                <span className={styles.googleCalendarName}>
                                  {calendar.summary}
                                  {calendar.primary && (
                                    <span className={styles.googleCalendarBadge}>primary</span>
                                  )}
                                </span>
                                {added ? (
                                  <button
                                    className={styles.removeCalendarBtn}
                                    onClick={() => removeGoogleCalendar(calendar.id)}
                                    type="button"
                                    aria-label={`Remove ${calendar.summary}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : (
                                  <button
                                    className={styles.addCalendarBtn}
                                    onClick={() => addGoogleCalendar(calendar)}
                                    type="button"
                                    aria-label={`Add ${calendar.summary}`}
                                  >
                                    <Plus size={14} />
                                    Add
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>

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

                {isClockOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Clock</h3>
                    <div className={styles.intervalRow}>
                      <label className={styles.intervalLabel}>
                        <span>Time font size (rem)</span>
                        <input
                          className={styles.numberInput}
                          type="number"
                          min={0.5}
                          max={40}
                          step={0.1}
                          value={clockTimeFontSize}
                          placeholder="Auto"
                          onChange={(e) => setClockTimeFontSize(e.target.value)}
                        />
                      </label>
                      <label className={styles.intervalLabel}>
                        <span>Date font size (rem)</span>
                        <input
                          className={styles.numberInput}
                          type="number"
                          min={0.5}
                          max={40}
                          step={0.1}
                          value={clockDateFontSize}
                          placeholder="Auto"
                          onChange={(e) => setClockDateFontSize(e.target.value)}
                        />
                      </label>
                      <label className={styles.intervalLabel}>
                        <span>Time stretch (%)</span>
                        <input
                          className={styles.numberInput}
                          type="number"
                          min={50}
                          max={200}
                          step={1}
                          value={clockTimeStretch}
                          placeholder="100"
                          onChange={(e) => setClockTimeStretch(e.target.value)}
                        />
                      </label>
                    </div>
                    <p className={styles.hint}>
                      Leave size fields empty to keep automatic sizing based on the clock row height. Stretch uses 100% by default.
                    </p>
                  </section>
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

                {isSportsOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Sports Scores</h3>

                    <div className={styles.intervalRow}>
                      <label className={styles.intervalLabel}>
                        <span>Refresh every (minutes)</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={1440}
                          value={sportsRefreshMin}
                          onChange={(e) =>
                            setSportsRefreshMin(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                          }
                        />
                      </label>
                    </div>

                    <p className={styles.listHeading}>Enabled leagues</p>
                    <div className={styles.widgetGrid}>
                      {SPORTS_LEAGUE_OPTIONS.map((league) => {
                        const enabled = sportsEnabledLeagues.includes(league.id);
                        return (
                          <button
                            key={league.id}
                            className={[
                              styles.widgetToggle,
                              enabled ? styles.widgetVisible : "",
                            ].join(" ")}
                            onClick={() => toggleSportsLeague(league.id)}
                            type="button"
                            aria-pressed={enabled}
                          >
                            {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{league.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className={styles.listHeading}>Followed leagues (league score feed)</p>
                    <div className={styles.widgetGrid}>
                      {SPORTS_LEAGUE_OPTIONS.map((league) => {
                        const followed = sportsFollowedLeagues.includes(league.id);
                        return (
                          <button
                            key={`follow-${league.id}`}
                            className={[
                              styles.widgetToggle,
                              followed ? styles.widgetVisible : "",
                            ].join(" ")}
                            onClick={() => toggleSportsFollowedLeague(league.id)}
                            type="button"
                            aria-pressed={followed}
                          >
                            {followed ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{league.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className={styles.listHeading}>Favorite teams</p>
                    {sportsFavoriteTeams.length === 0 ? (
                      <p className={styles.hint}>No favorite teams selected yet.</p>
                    ) : (
                      sportsFavoriteTeamsByLeague.map(([leagueName, teams]) => (
                        <div key={leagueName} className={styles.calendarList}>
                          <p className={styles.listHeading}>{leagueName}</p>
                          {teams.map((team) => (
                            <div
                              key={`${team.leagueId}:${team.id}`}
                              className={styles.calendarRow}
                            >
                              <span
                                className={[
                                  styles.input,
                                  styles.calendarUrlInput,
                                  styles.readonlyPill,
                                ].join(" ")}
                              >
                                {team.name}
                              </span>
                              <button
                                type="button"
                                className={styles.removeCalendarBtn}
                                onClick={() => removeFavoriteTeam(team)}
                                aria-label={`Remove ${team.name}`}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ))
                    )}

                    <label className={styles.intervalLabel}>
                      <span>Search teams</span>
                      <input
                        className={styles.input}
                        type="text"
                        value={sportsTeamQuery}
                        onChange={(e) => setSportsTeamQuery(e.target.value)}
                        placeholder="e.g. Arsenal, Real Madrid, Lakers"
                      />
                    </label>

                    {sportsTeamSearchLoading ? (
                      <p className={styles.hint}>Searching teams…</p>
                    ) : null}
                    {sportsTeamSearchError ? (
                      <p className={styles.mediaLinkError}>{sportsTeamSearchError}</p>
                    ) : null}
                    {!sportsTeamSearchLoading &&
                    sportsTeamQuery.trim().length >= 2 &&
                    sportsTeamSearchResults.length === 0 &&
                    !sportsTeamSearchError ? (
                      <p className={styles.hint}>
                        No teams found in selected leagues. Try another query or enable more leagues.
                      </p>
                    ) : null}
                    {!sportsTeamSearchLoading &&
                    sortedSportsSearchResults.length > 0 ? (
                      <div className={styles.calendarList}>
                        {sortedSportsSearchResults.map((team) => {
                          const alreadyAdded = sportsFavoriteTeams.some(
                            (favorite) =>
                              favorite.id === team.id &&
                              favorite.leagueId === team.leagueId,
                          );
                          return (
                            <div
                              key={`${team.leagueId}:${team.id}`}
                              className={styles.calendarRow}
                            >
                              <span
                                className={[
                                  styles.input,
                                  styles.calendarUrlInput,
                                  styles.readonlyPill,
                                ].join(" ")}
                              >
                                {team.name} • {team.leagueName}
                              </span>
                              <button
                                type="button"
                                className={styles.addCalendarBtn}
                                disabled={alreadyAdded}
                                onClick={() => addFavoriteTeam(team)}
                              >
                                {alreadyAdded ? "Added" : "Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <p className={styles.hint}>
                      Includes European football leagues and major US leagues.
                    </p>
                  </section>
                )}

                {isMusicOnLayout && (
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Music Embeds</h3>
                    {isSpotifyOnLayout && (
                      <>
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionTitle}>Spotify account</span>
                          {spotifyAuth ? (
                            <button
                              className={styles.removeCalendarBtn}
                              onClick={handleDisconnectSpotify}
                              type="button"
                            >
                              Disconnect Spotify
                            </button>
                          ) : (
                            <button
                              className={styles.googleConnectBtn}
                              onClick={handleConnectSpotify}
                              type="button"
                              disabled={spotifyAuthLoading}
                            >
                              <MediaBrandIcon brand="spotify" size={14} className={styles.googleLogo} />
                              {spotifyAuthLoading ? "Connecting…" : "Connect Spotify"}
                            </button>
                          )}
                        </div>
                        <p className={styles.hint}>
                          {spotifyAuth
                            ? "Spotify is connected in this browser."
                            : "Connecting Spotify is optional."}
                        </p>
                        {spotifyAuthNotice && (
                          <p
                            className={styles.hint}
                            style={{
                              color:
                                spotifyAuthNotice.type === "error"
                                  ? "var(--color-error, #ef4444)"
                                  : undefined,
                            }}
                          >
                            {spotifyAuthNotice.message}
                          </p>
                        )}
                      </>
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
