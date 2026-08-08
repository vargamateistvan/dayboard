import { useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  normalizeSpotifyPodcastEmbedUrl,
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
  type CalendarFeed,
  type CalendarWeekStartsOn,
  type Theme,
  type ColorScheme,
  type CustomColors,
  type WeatherUnitSystem,
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

interface Props {
  readonly onClose: () => void;
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
        <div className={styles.widgetPaletteChips}>
          {allWidgets.map((widget) => {
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


export function SettingsDialog({ onClose }: Props) {
  const { settings, updateSettings } = useSettings();
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
  const [weatherRefreshMin, setWeatherRefreshMin] = useState(
    settings.weatherRefreshMinutes,
  );
  const [weatherUnitSystem, setWeatherUnitSystem] = useState<WeatherUnitSystem>(
    settings.weatherUnitSystem,
  );
  const [weatherShowExtraDetails, setWeatherShowExtraDetails] = useState(
    settings.weatherShowExtraDetails,
  );
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
  const [spotifyPodcastEmbedUrl, setSpotifyPodcastEmbedUrl] = useState(settings.spotifyPodcastEmbedUrl);
  const [spotifyPodcastEmbedLinks, setSpotifyPodcastEmbedLinks] = useState(
    normalizeSavedMediaLinks(settings.spotifyPodcastEmbedLinks, settings.spotifyPodcastEmbedUrl),
  );
  const [spotifyPodcastAddUrl, setSpotifyPodcastAddUrl] = useState("");
  const [spotifyPodcastLinkError, setSpotifyPodcastLinkError] = useState<string | null>(null);
  const [applePodcastEmbedUrl, setApplePodcastEmbedUrl] = useState(settings.applePodcastEmbedUrl);
  const [applePodcastEmbedLinks, setApplePodcastEmbedLinks] = useState(
    normalizeSavedMediaLinks(settings.applePodcastEmbedLinks, settings.applePodcastEmbedUrl),
  );
  const [applePodcastAddUrl, setApplePodcastAddUrl] = useState("");
  const [applePodcastLinkError, setApplePodcastLinkError] = useState<string | null>(null);
  const [showBuyMeACoffeeWidget, setShowBuyMeACoffeeWidget] = useState(
    settings.showBuyMeACoffeeWidget,
  );
  const [calendarHidePastEvents, setCalendarHidePastEvents] = useState(
    settings.calendarHidePastEvents,
  );
  const [calendarShowMonthlyOverview, setCalendarShowMonthlyOverview] = useState(
    settings.calendarShowMonthlyOverview,
  );
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

  const addMediaLink = ({
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

    const title = resolveMediaLinkTitle(normalized);
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

  const save = () => {
    updateSettings({
      calendarFeeds,
      weatherRefreshMinutes: weatherRefreshMin,
      weatherUnitSystem,
      weatherShowExtraDetails,
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
      spotifyPodcastEmbedUrl,
      spotifyPodcastEmbedLinks: normalizeSavedMediaLinks(
        spotifyPodcastEmbedLinks,
        spotifyPodcastEmbedUrl ? createSavedMediaLink(spotifyPodcastEmbedUrl) : undefined,
      ),
      applePodcastEmbedUrl,
      applePodcastEmbedLinks: normalizeSavedMediaLinks(
        applePodcastEmbedLinks,
        applePodcastEmbedUrl ? createSavedMediaLink(applePodcastEmbedUrl) : undefined,
      ),
      showBuyMeACoffeeWidget,
      calendarHidePastEvents,
      calendarShowMonthlyOverview,
      calendarShowAllDayEvents,
      calendarWeekStartsOn,
      pomodoroWorkMinutes: workMin,
      pomodoroBreakMinutes: breakMin,
      ...(settings.theme === "custom" && { customColors }),
    });
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
          {/* Widget Layout */}
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

          {/* Theme */}
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

          {/* Custom Colors (shown when custom theme is selected) */}
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
                      <span className={styles.colorValue}>
                        {customColors.primary}
                      </span>
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
                      <span className={styles.colorValue}>
                        {customColors.primaryHover}
                      </span>
                    </div>
                  </label>
                </div>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Background Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.background}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            background: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.background}
                      </span>
                    </div>
                  </label>
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
                      <span className={styles.colorValue}>
                        {customColors.fontColor}
                      </span>
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
                      <span className={styles.colorValue}>
                        {customColors.secondaryFontColor}
                      </span>
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

          {/* Appearance */}
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

          {/* Fonts */}
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

          {/* Calendar */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Calendar Feeds</h3>
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
              will use that color in the calendar widget.
            </p>
            <div className={styles.calendarList}>
              {calendarFeeds.map((calendarFeed, index) => (
                <div
                  className={styles.calendarRow}
                  key={`${calendarFeed.url || "new"}-${calendarFeed.color}-${index}`}
                >
                  <input
                    className={[styles.input, styles.calendarUrlInput].join(
                      " ",
                    )}
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
                <span>Show monthly overview</span>
              </button>
            </div>
          </section>

          {/* Weather */}
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

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Music Embeds</h3>
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
                addMediaLink({
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
                addMediaLink({
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
            <MediaLinkEditor
              title="Spotify Podcast"
              brand="spotify"
              activeUrl={spotifyPodcastEmbedUrl}
              savedLinks={spotifyPodcastEmbedLinks}
              addUrl={spotifyPodcastAddUrl}
              addPlaceholder="https://open.spotify.com/show/..."
              onSelectUrl={(url) => {
                setSpotifyPodcastEmbedUrl(url);
                setSpotifyPodcastLinkError(null);
              }}
              onRemoveSelected={() =>
                removeMediaLink(
                  spotifyPodcastEmbedLinks,
                  spotifyPodcastEmbedUrl,
                  setSpotifyPodcastEmbedLinks,
                  setSpotifyPodcastEmbedUrl,
                )
              }
              onAddUrlChange={setSpotifyPodcastAddUrl}
              onAddLink={() =>
                addMediaLink({
                  value: spotifyPodcastAddUrl,
                  setValue: setSpotifyPodcastAddUrl,
                  links: spotifyPodcastEmbedLinks,
                  setLinks: setSpotifyPodcastEmbedLinks,
                  validate: normalizeSpotifyPodcastEmbedUrl,
                  setActiveUrl: setSpotifyPodcastEmbedUrl,
                  setError: setSpotifyPodcastLinkError,
                  errorMessage: "Please paste a valid Spotify podcast show or episode link.",
                })
              }
              error={spotifyPodcastLinkError}
            />
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
                addMediaLink({
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
            <p className={styles.hint}>
              Paste a public share link. Dayboard converts it to an embeddable player automatically.
            </p>
          </section>

          {/* Pomodoro */}
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

          {/* Support */}
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
