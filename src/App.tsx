import { useEffect, useRef, useState, useMemo } from 'react'
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

const WIDGET_RENDERERS = {
  clock: (isFullscreen: boolean) => <ClockWidget isFullscreen={isFullscreen} />,
  timezoneClock: (isFullscreen: boolean) => <TimezoneClockWidget isFullscreen={isFullscreen} />,
  weather: (isFullscreen: boolean) => <WeatherWidget isFullscreen={isFullscreen} />,
  flights: (isFullscreen: boolean) => <FlightWidget isFullscreen={isFullscreen} />,
  calendar: (isFullscreen: boolean) => <CalendarWidget isFullscreen={isFullscreen} />,
  timer: (isFullscreen: boolean) => <TimerPanel isFullscreen={isFullscreen} />,
  tasks: (isFullscreen: boolean) => <TaskWidget isFullscreen={isFullscreen} />,
  notes: (isFullscreen: boolean) => <NotesWidget isFullscreen={isFullscreen} />,
  spotify: (isFullscreen: boolean) => <SpotifyWidget isFullscreen={isFullscreen} />,
  appleMusic: (isFullscreen: boolean) => <AppleMusicWidget isFullscreen={isFullscreen} />,
  applePodcast: (isFullscreen: boolean) => <ApplePodcastWidget isFullscreen={isFullscreen} />,
  stocks: (isFullscreen: boolean) => <StockWidget isFullscreen={isFullscreen} />,
  currencies: (isFullscreen: boolean) => <CurrencyWidget isFullscreen={isFullscreen} />,
  sports: (isFullscreen: boolean) => <SportsScoresWidget isFullscreen={isFullscreen} />,
  quote: (isFullscreen: boolean) => <QuoteWidget isFullscreen={isFullscreen} />,
  deviceInfo: (isFullscreen: boolean) => <DeviceInfoWidget isFullscreen={isFullscreen} />,
} satisfies Record<Widget, (isFullscreen: boolean) => JSX.Element | null>

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
  readonly placement: { column: number; row: number; columnSpan: number; rowSpan: number }
  readonly onToggleFullscreen: (widget: Widget) => void
}

function WidgetCell({
  widget,
  isFullscreen,
  isHidden,
  focusMode,
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
      <div className={styles.widgetContentFrame}>{WIDGET_RENDERERS[widget](isFullscreen)}</div>
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

  const toggleAppFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    try {
      await document.documentElement.requestFullscreen()
    } catch (error) {
      console.error('Fullscreen request failed:', error)
    }
  }

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
  const [selectedPresetName, setSelectedPresetName] = useState('')

  const currentPresetName = useMemo(
    () =>
      presets.find((preset) => {
        const settingsMatch = deepEqual(preset.settings, settings)
        if (!settingsMatch) {
          return false
        }

        if (!preset.layout) {
          return true
        }

        return deepEqual(preset.layout, {
          rowCount,
          visibility,
          placements,
        })
      })?.name ?? '',
    [presets, settings, rowCount, visibility, placements]
  )

  const selectedPresetExists = Boolean(
    selectedPresetName && presets.some((preset) => preset.name === selectedPresetName),
  )
  const visiblePresetName = currentPresetName || (selectedPresetExists ? selectedPresetName : '')

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

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((candidate) => candidate.name === presetName)
    if (!preset) {
      return
    }

    applyPreset(preset.name)
    updateSettings(preset.settings)
    setSelectedPresetName(preset.name)
  }

  return { visiblePresetName, handlePresetChange }
}

function useVisibleWidgets(
  order: Widget[],
  visibility: ReturnType<typeof useWidgetVisibility>['visibility'],
  focusMode: boolean,
) {
  const [fullscreenWidget, setFullscreenWidget] = useState<Widget | null>(null)

  const orderedVisibleWidgets = useMemo(
    () =>
      order.filter((widget) => {
        if (!visibility[widget]) {
          return false
        }

        if (focusMode && (widget === 'weather' || widget === 'calendar')) {
          return false
        }

        return true
      }),
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

  const handleToggleFullscreen = (widget: Widget) => {
    setFullscreenWidget((current) => (current === widget ? null : widget))
  }

  return { orderedVisibleWidgets, fullscreenWidget, handleToggleFullscreen }
}

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [presets, setPresets] = useState<SettingsPreset[]>(() => listPresets())
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode } = useFocusMode()
  const { settings, updateSettings } = useSettings()
  const { visibility, order, placements, rowCount } = useWidgetVisibility()
  const { appFullscreen, toggleAppFullscreen } = useAppFullscreen()
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

  useEffect(() => {
    const refreshPresets = () => {
      setPresets(listPresets())
    }

    window.addEventListener('settingsPresetsChanged', refreshPresets)
    return () => window.removeEventListener('settingsPresetsChanged', refreshPresets)
  }, [])

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
          onSelectPreset={handlePresetChange}
        />
      ) : null}
      <div className={styles.toolbarButtons}>
        <button
          className={styles.toolbarButton}
          onClick={() => setInfoOpen(true)}
          aria-label="Open app info"
          title="About Dayboard"
          type="button"
        >
          <Info size={18} />
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings"
          type="button"
        >
          <Settings size={18} />
        </button>
        <button
          className={styles.toolbarButton}
          onClick={() => {
            void toggleAppFullscreen()
          }}
          aria-label={appFullscreen ? 'Exit app fullscreen' : 'Enter app fullscreen'}
          title={appFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          type="button"
        >
          {appFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <main className={styles.main} style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}>
        {orderedVisibleWidgets.map((widget) => (
          <WidgetCell
            key={widget}
            widget={widget}
            isFullscreen={fullscreenWidget === widget}
            isHidden={Boolean(fullscreenWidget && fullscreenWidget !== widget)}
            focusMode={focusMode}
            placement={placements[widget]}
            onToggleFullscreen={handleToggleFullscreen}
          />
        ))}
      </main>

      <NotificationBadge notifications={notifications} onDismiss={dismissNotification} />
      {/* BuyMeCoffeeWidget is intentionally rendered outside the widget grid as a fixed UI element, not managed by the widget visibility system */}
      <BuyMeCoffeeWidget />
      {infoOpen && <InfoDialog onClose={() => setInfoOpen(false)} />}
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          selectedPresetName={visiblePresetName}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Dashboard />
    </SettingsProvider>
  )
}
