import { useCallback, useEffect, useRef, useState, useMemo, type ComponentProps } from 'react'
import { Check, ChevronDown, Info, Maximize2, Minimize2, Settings } from 'lucide-react'
import { applyPreset, listPresets, type SettingsPreset } from './lib/settings'
import { SettingsProvider, useSettings } from './lib/useSettings'
import { useEventNotifications } from './lib/useEventNotifications'
import { useFocusMode } from './lib/useFocusMode'
import { type Widget, useWidgetVisibility } from './lib/useWidgetVisibility'
import { getWidgetLabel } from './lib/widgetMetadata'
import { ClockWidget } from './components/ClockWidget'
import { TimezoneClockWidget } from './components/TimezoneClockWidget'
import { WeatherWidget } from './components/WeatherWidget'
import { FlightWidget } from './components/FlightWidget'
import { CalendarWidget } from './components/CalendarWidget'
import { TimerPanel } from './components/TimerPanel'
import { TaskWidget } from './components/TaskWidget'
import { MiniKanbanWidget } from './components/MiniKanbanWidget'
import { NotesWidget } from './components/NotesWidget'
import { SpotifyWidget } from './components/SpotifyWidget'
import { AppleMusicWidget } from './components/AppleMusicWidget'
import { ApplePodcastWidget } from './components/ApplePodcastWidget'
import { StockWidget } from './components/StockWidget'
import { CurrencyWidget } from './components/CurrencyWidget'
import { SportsScoresWidget } from './components/SportsScoresWidget'
import { QuoteWidget } from './components/QuoteWidget'
import { DeviceInfoWidget } from './components/DeviceInfoWidget'
import { BuyMeCoffeeWidget } from './components/BuyMeCoffeeWidget'
import { InfoDialog } from './components/InfoDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { NotificationBadge } from './components/NotificationBadge'
import './themes/base.css'
import './themes/default.css'
import './themes/retro.css'
import './themes/futuristic.css'
import './themes/nature.css'
import './themes/ocean.css'
import './themes/sunset.css'
import './themes/custom.css'
import styles from './App.module.css'

const ACTIVE_PRESET_STORAGE_KEY = 'dayboard:active-preset'

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false
  }

  return true
}

function getWidgetTypeClass(widget: Widget) {
  if (widget === 'clock' || widget === 'timezoneClock') {
    return styles.widgetClock
  }

  if (widget === 'calendar') {
    return styles.widgetCalendar
  }

  return ''
}

function getVisibleWidgetOrder(
  order: Widget[],
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  focusMode: boolean,
) {
  return order.filter((widget) => {
    if (!visibility[widget]) {
      return false
    }

    if (focusMode && (widget === 'weather' || widget === 'calendar')) {
      return false
    }

    return true
  })
}

function presetMatchesLayout(
  preset: SettingsPreset,
  rowCount: number,
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  placements: ReturnType<typeof useWidgetVisibility>['placements'],
) {
  if (!preset.layout) {
    return true
  }

  return deepEqual(preset.layout, {
    rowCount,
    visibility,
    placements,
  })
}

function presetMatchesSettings(
  preset: SettingsPreset,
  settings: ReturnType<typeof useSettings>['settings'],
  rowCount: number,
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  placements: ReturnType<typeof useWidgetVisibility>['placements'],
) {
  return deepEqual(preset.settings, settings) && presetMatchesLayout(preset, rowCount, visibility, placements)
}

const WIDGET_RENDERERS = {
  clock: (isFullscreen: boolean, rowCount: number) => <ClockWidget isFullscreen={isFullscreen} rowCount={rowCount} />,
  timezoneClock: (isFullscreen: boolean) => <TimezoneClockWidget isFullscreen={isFullscreen} />,
  weather: (isFullscreen: boolean) => <WeatherWidget isFullscreen={isFullscreen} />,
  flights: (isFullscreen: boolean) => <FlightWidget isFullscreen={isFullscreen} />,
  calendar: (isFullscreen: boolean) => <CalendarWidget isFullscreen={isFullscreen} />,
  timer: (isFullscreen: boolean) => <TimerPanel isFullscreen={isFullscreen} />,
  tasks: (isFullscreen: boolean) => <TaskWidget isFullscreen={isFullscreen} />,
  kanban: (isFullscreen: boolean) => <MiniKanbanWidget isFullscreen={isFullscreen} />,
  notes: (isFullscreen: boolean) => <NotesWidget isFullscreen={isFullscreen} />,
  spotify: (isFullscreen: boolean) => <SpotifyWidget isFullscreen={isFullscreen} />,
  appleMusic: (isFullscreen: boolean) => <AppleMusicWidget isFullscreen={isFullscreen} />,
  applePodcast: (isFullscreen: boolean) => <ApplePodcastWidget isFullscreen={isFullscreen} />,
  stocks: (isFullscreen: boolean) => <StockWidget isFullscreen={isFullscreen} />,
  currencies: (isFullscreen: boolean) => <CurrencyWidget isFullscreen={isFullscreen} />,
  sports: (isFullscreen: boolean) => <SportsScoresWidget isFullscreen={isFullscreen} />,
  quote: (isFullscreen: boolean) => <QuoteWidget isFullscreen={isFullscreen} />,
  deviceInfo: (isFullscreen: boolean) => <DeviceInfoWidget isFullscreen={isFullscreen} />,
} satisfies Record<Widget, (isFullscreen: boolean, rowCount: number) => JSX.Element | null>

interface PresetSelectorProps {
  readonly presets: SettingsPreset[]
  readonly visiblePresetName: string
  readonly onSelectPreset: (presetName: string) => void
}

function PresetSelector({ presets, visiblePresetName, onSelectPreset }: PresetSelectorProps) {
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const presetMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!presetMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (presetMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setPresetMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPresetMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [presetMenuOpen])

  return (
    <div className={styles.presetSelectorWrap} ref={presetMenuRef}>
      <button
        className={styles.presetSelectorTrigger}
        aria-label="Select preset"
        aria-haspopup="menu"
        aria-expanded={presetMenuOpen}
        type="button"
        onClick={() => setPresetMenuOpen((current) => !current)}
      >
        <span className={styles.presetSelectorLabel}>Preset</span>
        <span className={styles.presetSelectorValue}>{visiblePresetName || 'Custom'}</span>
        <ChevronDown
          size={16}
          className={[styles.presetSelectorChevron, presetMenuOpen ? styles.presetSelectorChevronOpen : ''].join(' ')}
        />
      </button>
      {presetMenuOpen ? (
        <div className={styles.presetMenu} aria-label="Preset options">
          {presets.map((preset) => {
            const isSelected = preset.name === visiblePresetName

            return (
              <button
                key={preset.name}
                className={[styles.presetMenuItem, isSelected ? styles.presetMenuItemSelected : ''].join(' ')}
                type="button"
                onClick={() => {
                  onSelectPreset(preset.name)
                  setPresetMenuOpen(false)
                }}
              >
                <span className={styles.presetMenuItemCheck}>
                  {isSelected ? <Check size={14} /> : null}
                </span>
                <span className={styles.presetMenuItemLabel}>{preset.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

interface WidgetCellProps {
  readonly widget: Widget
  readonly isFullscreen: boolean
  readonly isHidden: boolean
  readonly focusMode: boolean
  readonly rowCount: number
  readonly placement: { column: number; row: number; columnSpan: number; rowSpan: number }
  readonly onToggleFullscreen: (widget: Widget) => void
}

function WidgetCell({
  widget,
  isFullscreen,
  isHidden,
  focusMode,
  rowCount,
  placement,
  onToggleFullscreen,
}: WidgetCellProps) {
  return (
    <div
      className={[
        styles.widgetCell,
        getWidgetTypeClass(widget),
        isFullscreen ? styles.widgetCellFullscreen : '',
        isHidden ? styles.widgetCellHidden : '',
      ].join(' ')}
      data-widget-id={widget}
      style={
        focusMode
          ? undefined
          : {
              gridColumn: `${placement.column} / span ${placement.columnSpan}`,
              gridRow: `${placement.row} / span ${placement.rowSpan}`,
            }
      }
    >
      <button
        className={styles.widgetFullscreenBtn}
        onClick={() => onToggleFullscreen(widget)}
        aria-label={`${isFullscreen ? 'Exit' : 'Enter'} fullscreen for ${getWidgetLabel(widget)}`}
        title={`${isFullscreen ? 'Exit' : 'Enter'} fullscreen`}
        type="button"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      <div className={styles.widgetContentFrame}>{WIDGET_RENDERERS[widget](isFullscreen, rowCount)}</div>
    </div>
  )
}

interface ToolbarProps {
  readonly appFullscreen: boolean
  readonly onOpenInfo: () => void
  readonly onOpenSettings: () => void
  readonly onToggleAppFullscreen: () => void
}

function Toolbar({ appFullscreen, onOpenInfo, onOpenSettings, onToggleAppFullscreen }: ToolbarProps) {
  return (
    <div className={styles.toolbarButtons}>
      <button
        className={styles.toolbarButton}
        onClick={onOpenInfo}
        aria-label="Open app info"
        title="About Dayboard"
        type="button"
      >
        <Info size={18} />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={onOpenSettings}
        aria-label="Open settings"
        title="Settings"
        type="button"
      >
        <Settings size={18} />
      </button>
      <button
        className={styles.toolbarButton}
        onClick={onToggleAppFullscreen}
        aria-label={appFullscreen ? 'Exit app fullscreen' : 'Enter app fullscreen'}
        title={appFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        type="button"
      >
        {appFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  )
}

interface ShellPanelsProps {
  readonly infoOpen: boolean
  readonly settingsOpen: boolean
  readonly visiblePresetName: string
  readonly onCloseInfo: () => void
  readonly onCloseSettings: () => void
  readonly notifications: ComponentProps<typeof NotificationBadge>['notifications']
  readonly onDismissNotification: ComponentProps<typeof NotificationBadge>['onDismiss']
}

function ShellPanels({
  infoOpen,
  settingsOpen,
  visiblePresetName,
  onCloseInfo,
  onCloseSettings,
  notifications,
  onDismissNotification,
}: ShellPanelsProps) {
  return (
    <>
      <NotificationBadge notifications={notifications} onDismiss={onDismissNotification} />
      {/* BuyMeCoffeeWidget is intentionally rendered outside the widget grid as a fixed UI element, not managed by the widget visibility system */}
      <BuyMeCoffeeWidget />
      {infoOpen && <InfoDialog onClose={onCloseInfo} />}
      {settingsOpen && <SettingsDialog onClose={onCloseSettings} selectedPresetName={visiblePresetName} />}
    </>
  )
}

interface DashboardLayoutProps {
  readonly focusMode: boolean
  readonly fullscreenWidget: Widget | null
  readonly appFullscreen: boolean
  readonly rowCount: number
  readonly presets: SettingsPreset[]
  readonly visiblePresetName: string
  readonly orderedVisibleWidgets: Widget[]
  readonly placements: ReturnType<typeof useWidgetVisibility>['placements']
  readonly notifications: ComponentProps<typeof NotificationBadge>['notifications']
  readonly infoOpen: boolean
  readonly settingsOpen: boolean
  readonly onOpenInfo: () => void
  readonly onOpenSettings: () => void
  readonly onToggleAppFullscreen: () => void
  readonly onToggleWidgetFullscreen: (widget: Widget) => void
  readonly onCloseInfo: () => void
  readonly onCloseSettings: () => void
  readonly onSelectPreset: (presetName: string) => void
  readonly onDismissNotification: ComponentProps<typeof NotificationBadge>['onDismiss']
}

function DashboardLayout({
  focusMode,
  fullscreenWidget,
  appFullscreen,
  rowCount,
  presets,
  visiblePresetName,
  orderedVisibleWidgets,
  placements,
  notifications,
  infoOpen,
  settingsOpen,
  onOpenInfo,
  onOpenSettings,
  onToggleAppFullscreen,
  onToggleWidgetFullscreen,
  onCloseInfo,
  onCloseSettings,
  onSelectPreset,
  onDismissNotification,
}: DashboardLayoutProps) {
  return (
    <div
      className={[
        styles.app,
        focusMode ? styles.focusMode : '',
        fullscreenWidget ? styles.fullscreenMode : '',
      ].join(' ')}
    >
      {presets.length > 1 ? (
        <PresetSelector
          presets={presets}
          visiblePresetName={visiblePresetName}
          onSelectPreset={onSelectPreset}
        />
      ) : null}
      <Toolbar
        appFullscreen={appFullscreen}
        onOpenInfo={onOpenInfo}
        onOpenSettings={onOpenSettings}
        onToggleAppFullscreen={onToggleAppFullscreen}
      />

      <main className={styles.main} style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}>
        {orderedVisibleWidgets.map((widget) => (
          <WidgetCell
            key={widget}
            widget={widget}
            isFullscreen={fullscreenWidget === widget}
            isHidden={Boolean(fullscreenWidget && fullscreenWidget !== widget)}
            focusMode={focusMode}
            rowCount={rowCount}
            placement={placements[widget]}
            onToggleFullscreen={onToggleWidgetFullscreen}
          />
        ))}
      </main>

      <ShellPanels
        infoOpen={infoOpen}
        settingsOpen={settingsOpen}
        visiblePresetName={visiblePresetName}
        onCloseInfo={onCloseInfo}
        onCloseSettings={onCloseSettings}
        notifications={notifications}
        onDismissNotification={onDismissNotification}
      />
    </div>
  )
}

function useAppFullscreen() {
  const [appFullscreen, setAppFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setAppFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    handleFullscreenChange()

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleAppFullscreen = useCallback(() => {
    void (async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      try {
        await document.documentElement.requestFullscreen()
      } catch (error) {
        console.error('Fullscreen request failed:', error)
      }
    })()
  }, [])

  return { appFullscreen, toggleAppFullscreen }
}

function usePresetSelection(
  presets: SettingsPreset[],
  settings: ReturnType<typeof useSettings>['settings'],
  rowCount: number,
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  placements: ReturnType<typeof useWidgetVisibility>['placements'],
  updateSettings: ReturnType<typeof useSettings>['updateSettings'],
) {
  const [selectedPresetName, setSelectedPresetName] = useState(() =>
    localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY) ?? '',
  )

  const currentPresetName = useMemo(
    () => presets.find((preset) => presetMatchesSettings(preset, settings, rowCount, visibility, placements))?.name ?? '',
    [presets, settings, rowCount, visibility, placements],
  )

  const selectedPresetExists = Boolean(
    selectedPresetName && presets.some((preset) => preset.name === selectedPresetName),
  )
  const visiblePresetName = currentPresetName || (selectedPresetExists ? selectedPresetName : '')

  useEffect(() => {
    if (visiblePresetName) {
      localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, visiblePresetName)
      return
    }

    localStorage.removeItem(ACTIVE_PRESET_STORAGE_KEY)
  }, [visiblePresetName])

  useEffect(() => {
    // Sync selected preset with current preset when current changes
    if (currentPresetName && currentPresetName !== selectedPresetName) {
      setSelectedPresetName(currentPresetName)
      return
    }

    // Clear selected preset if it no longer exists
    if (selectedPresetName && !selectedPresetExists) {
      setSelectedPresetName('')
    }
  }, [currentPresetName, selectedPresetName, selectedPresetExists])

  const handlePresetChange = useCallback((presetName: string) => {
    const preset = presets.find((candidate) => candidate.name === presetName)
    if (!preset) {
      return
    }

    applyPreset(preset.name)
    updateSettings(preset.settings)
    setSelectedPresetName(preset.name)
  }, [presets, updateSettings])

  return { visiblePresetName, handlePresetChange }
}

function useVisibleWidgets(
  order: Widget[],
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  focusMode: boolean,
) {
  const [fullscreenWidget, setFullscreenWidget] = useState<Widget | null>(null)

  const orderedVisibleWidgets = useMemo(
    () => getVisibleWidgetOrder(order, visibility, focusMode),
    [order, visibility, focusMode],
  )

  useEffect(() => {
    if (fullscreenWidget && !orderedVisibleWidgets.includes(fullscreenWidget)) {
      setFullscreenWidget(null)
    }
  }, [fullscreenWidget, orderedVisibleWidgets])

  useEffect(() => {
    if (!fullscreenWidget) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreenWidget(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenWidget])

  const handleToggleFullscreen = useCallback((widget: Widget) => {
    setFullscreenWidget((current) => (current === widget ? null : widget))
  }, [])

  return { orderedVisibleWidgets, fullscreenWidget, handleToggleFullscreen }
}

function usePresets() {
  const [presets, setPresets] = useState<SettingsPreset[]>(() => listPresets())

  useEffect(() => {
    const refreshPresets = () => {
      setPresets(listPresets())
    }

    window.addEventListener('settingsPresetsChanged', refreshPresets)
    return () => window.removeEventListener('settingsPresetsChanged', refreshPresets)
  }, [])

  return presets
}

function useShellPanels() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const openInfo = useCallback(() => setInfoOpen(true), [])
  const closeInfo = useCallback(() => setInfoOpen(false), [])

  return {
    settingsOpen,
    infoOpen,
    openSettings,
    closeSettings,
    openInfo,
    closeInfo,
  }
}

function Dashboard() {
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode } = useFocusMode()
  const { settings, updateSettings } = useSettings()
  const { visibility, order, placements, rowCount } = useWidgetVisibility()
  const { appFullscreen, toggleAppFullscreen } = useAppFullscreen()
  const presets = usePresets()
  const { settingsOpen, infoOpen, openSettings, closeSettings, openInfo, closeInfo } =
    useShellPanels()
  const { orderedVisibleWidgets, fullscreenWidget, handleToggleFullscreen } = useVisibleWidgets(
    order,
    visibility,
    focusMode,
  )
  const { visiblePresetName, handlePresetChange } = usePresetSelection(
    presets,
    settings,
    rowCount,
    visibility,
    placements,
    updateSettings,
  )

  const dashboardLayoutProps = {
    focusMode,
    fullscreenWidget,
    appFullscreen,
    rowCount,
    presets,
    visiblePresetName,
    orderedVisibleWidgets,
    placements,
    notifications,
    infoOpen,
    settingsOpen,
    onOpenInfo: openInfo,
    onOpenSettings: openSettings,
    onToggleAppFullscreen: toggleAppFullscreen,
    onToggleWidgetFullscreen: handleToggleFullscreen,
    onCloseInfo: closeInfo,
    onCloseSettings: closeSettings,
    onSelectPreset: handlePresetChange,
    onDismissNotification: dismissNotification,
  } satisfies DashboardLayoutProps

  return (
    <DashboardLayout {...dashboardLayoutProps} />
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Dashboard />
    </SettingsProvider>
  )
}
