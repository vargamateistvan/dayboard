import { useEffect, useRef, useState } from 'react'
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
import { CalendarWidget } from './components/CalendarWidget'
import { TimerPanel } from './components/TimerPanel'
import { TaskWidget } from './components/TaskWidget'
import { NotesWidget } from './components/NotesWidget'
import { SpotifyWidget } from './components/SpotifyWidget'
import { AppleMusicWidget } from './components/AppleMusicWidget'
import { ApplePodcastWidget } from './components/ApplePodcastWidget'
import { StockWidget } from './components/StockWidget'
import { CurrencyWidget } from './components/CurrencyWidget'
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

function renderWidget(widget: Widget, isFullscreen: boolean) {
  switch (widget) {
    case 'clock':
      return <ClockWidget isFullscreen={isFullscreen} />
    case 'timezoneClock':
      return <TimezoneClockWidget isFullscreen={isFullscreen} />
    case 'weather':
      return <WeatherWidget isFullscreen={isFullscreen} />
    case 'calendar':
      return <CalendarWidget isFullscreen={isFullscreen} />
    case 'timer':
      return <TimerPanel isFullscreen={isFullscreen} />
    case 'tasks':
      return <TaskWidget isFullscreen={isFullscreen} />
    case 'notes':
      return <NotesWidget isFullscreen={isFullscreen} />
    case 'spotify':
      return <SpotifyWidget isFullscreen={isFullscreen} />
    case 'appleMusic':
      return <AppleMusicWidget isFullscreen={isFullscreen} />
    case 'applePodcast':
      return <ApplePodcastWidget isFullscreen={isFullscreen} />
    case 'stocks':
      return <StockWidget isFullscreen={isFullscreen} />
    case 'currencies':
      return <CurrencyWidget isFullscreen={isFullscreen} />
    case 'quote':
      return <QuoteWidget isFullscreen={isFullscreen} />
    case 'deviceInfo':
      return <DeviceInfoWidget isFullscreen={isFullscreen} />
  }
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

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [appFullscreen, setAppFullscreen] = useState(false)
  const [fullscreenWidget, setFullscreenWidget] = useState<Widget | null>(null)
  const [presets, setPresets] = useState<SettingsPreset[]>(() => listPresets())
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode } = useFocusMode()
  const { settings, updateSettings } = useSettings()
  const { visibility, order, placements, rowCount } = useWidgetVisibility()
  const presetMenuRef = useRef<HTMLDivElement | null>(null)
  const orderedVisibleWidgets = order.filter((widget) => {
    if (!visibility[widget]) {
      return false
    }

    if (focusMode && (widget === 'weather' || widget === 'calendar')) {
      return false
    }

    return true
  })

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setAppFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    handleFullscreenChange()

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const refreshPresets = () => {
      setPresets(listPresets())
    }

    window.addEventListener('settingsPresetsChanged', refreshPresets)
    return () => window.removeEventListener('settingsPresetsChanged', refreshPresets)
  }, [])

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

  const toggleAppFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }

  const currentPresetName =
    presets.find((preset) => {
      const settingsMatch = JSON.stringify(preset.settings) === JSON.stringify(settings)
      if (!settingsMatch) {
        return false
      }

      if (!preset.layout) {
        return true
      }

      return (
        JSON.stringify(preset.layout) ===
        JSON.stringify({
          rowCount,
          visibility,
          placements,
        })
      )
    })?.name ?? ''

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((candidate) => candidate.name === presetName)
    if (!preset) {
      return
    }

    applyPreset(preset.name)
    updateSettings(preset.settings)
    setPresetMenuOpen(false)
  }

  return (
    <div
      className={[
        styles.app,
        focusMode ? styles.focusMode : '',
        fullscreenWidget ? styles.fullscreenMode : '',
      ].join(' ')}
    >
      {presets.length > 1 ? (
        <div className={styles.presetSelectorWrap} ref={presetMenuRef}>
          <button
            className={styles.presetSelectorTrigger}
            aria-label="Select preset"
            aria-haspopup="listbox"
            aria-expanded={presetMenuOpen}
            type="button"
            onClick={() => setPresetMenuOpen((current) => !current)}
          >
            <span className={styles.presetSelectorLabel}>Preset</span>
            <span className={styles.presetSelectorValue}>{currentPresetName || 'Custom'}</span>
            <ChevronDown
              size={16}
              className={[styles.presetSelectorChevron, presetMenuOpen ? styles.presetSelectorChevronOpen : ''].join(' ')}
            />
          </button>
          {presetMenuOpen ? (
            <div className={styles.presetMenu} role="listbox" aria-label="Preset options">
              {presets.map((preset) => {
                const isSelected = preset.name === currentPresetName

                return (
                  <button
                    key={preset.name}
                    className={[styles.presetMenuItem, isSelected ? styles.presetMenuItemSelected : ''].join(' ')}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => handlePresetChange(preset.name)}
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
          <div
            key={widget}
            className={[
              styles.widgetCell,
              getWidgetTypeClass(widget),
              fullscreenWidget === widget ? styles.widgetCellFullscreen : '',
              fullscreenWidget && fullscreenWidget !== widget ? styles.widgetCellHidden : '',
            ].join(' ')}
            data-widget-id={widget}
            style={
              focusMode
                ? undefined
                : {
                    gridColumn: `${placements[widget].column} / span ${placements[widget].columnSpan}`,
                    gridRow: `${placements[widget].row} / span ${placements[widget].rowSpan}`,
                  }
            }
          >
            <button
              className={styles.widgetFullscreenBtn}
              onClick={() => setFullscreenWidget(fullscreenWidget === widget ? null : widget)}
              aria-label={`${fullscreenWidget === widget ? 'Exit' : 'Enter'} fullscreen for ${getWidgetLabel(widget)}`}
              title={`${fullscreenWidget === widget ? 'Exit' : 'Enter'} fullscreen`}
              type="button"
            >
              {fullscreenWidget === widget ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <div className={styles.widgetContentFrame}>{renderWidget(widget, fullscreenWidget === widget)}</div>
          </div>
        ))}
      </main>

      <NotificationBadge notifications={notifications} onDismiss={dismissNotification} />
      <BuyMeCoffeeWidget />
      {infoOpen && <InfoDialog onClose={() => setInfoOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
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
