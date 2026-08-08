import { useEffect, useState } from 'react'
import { Maximize2, Minimize2, Settings } from 'lucide-react'
import { SettingsProvider } from './lib/useSettings'
import { useEventNotifications } from './lib/useEventNotifications'
import { useFocusMode } from './lib/useFocusMode'
import { type Widget, useWidgetVisibility } from './lib/useWidgetVisibility'
import { getWidgetLabel } from './lib/widgetMetadata'
import { ClockWidget } from './components/ClockWidget'
import { WeatherWidget } from './components/WeatherWidget'
import { CalendarWidget } from './components/CalendarWidget'
import { TimerPanel } from './components/TimerPanel'
import { TaskWidget } from './components/TaskWidget'
import { NotesWidget } from './components/NotesWidget'
import { SpotifyWidget } from './components/SpotifyWidget'
import { AppleMusicWidget } from './components/AppleMusicWidget'
import { SpotifyPodcastWidget } from './components/SpotifyPodcastWidget'
import { ApplePodcastWidget } from './components/ApplePodcastWidget'
import { BuyMeCoffeeWidget } from './components/BuyMeCoffeeWidget'
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
    case 'spotifyPodcast':
      return <SpotifyPodcastWidget isFullscreen={isFullscreen} />
    case 'applePodcast':
      return <ApplePodcastWidget isFullscreen={isFullscreen} />
  }
}

function getWidgetTypeClass(widget: Widget) {
  if (widget === 'clock') {
    return styles.widgetClock
  }

  if (widget === 'calendar') {
    return styles.widgetCalendar
  }

  return ''
}

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreenWidget, setFullscreenWidget] = useState<Widget | null>(null)
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode } = useFocusMode()
  const { visibility, order, placements, rowCount } = useWidgetVisibility()
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

  return (
    <div
      className={[
        styles.app,
        focusMode ? styles.focusMode : '',
        fullscreenWidget ? styles.fullscreenMode : '',
      ].join(' ')}
    >
      <button
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
        type="button"
      >
        <Settings size={18} />
      </button>

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
