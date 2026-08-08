import { useState } from 'react'
import { Settings, Maximize2 } from 'lucide-react'
import { SettingsProvider } from './lib/useSettings'
import { useEventNotifications } from './lib/useEventNotifications'
import { useFocusMode } from './lib/useFocusMode'
import { type Widget, useWidgetVisibility } from './lib/useWidgetVisibility'
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

function renderWidget(widget: Widget) {
  switch (widget) {
    case 'clock':
      return <ClockWidget />
    case 'weather':
      return <WeatherWidget />
    case 'calendar':
      return <CalendarWidget />
    case 'timer':
      return <TimerPanel />
    case 'tasks':
      return <TaskWidget />
    case 'notes':
      return <NotesWidget />
    case 'spotify':
      return <SpotifyWidget />
    case 'appleMusic':
      return <AppleMusicWidget />
    case 'spotifyPodcast':
      return <SpotifyPodcastWidget />
    case 'applePodcast':
      return <ApplePodcastWidget />
  }
}

function getWidgetTypeClass(widget: Widget) {
  return widget === 'clock' ? styles.widgetClock : ''
}

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode, toggleFocusMode } = useFocusMode()
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

  return (
    <div className={`${styles.app} ${focusMode ? styles.focusMode : ''}`}>
      <button
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
        type="button"
      >
        <Settings size={18} />
      </button>

      <button
        className={`${styles.focusModeBtn} ${focusMode ? styles.active : ''}`}
        onClick={() => toggleFocusMode()}
        aria-label={`${focusMode ? 'Exit' : 'Enter'} focus mode`}
        title="Focus Mode (Cmd+K)"
        type="button"
      >
        <Maximize2 size={18} />
      </button>

      <main className={styles.main} style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}>
        {orderedVisibleWidgets.map((widget) => (
          <div
            key={widget}
            className={[
              styles.widgetCell,
              getWidgetTypeClass(widget),
            ].join(' ')}
            style={
              focusMode
                ? undefined
                : {
                    gridColumn: `${placements[widget].column} / span ${placements[widget].columnSpan}`,
                    gridRow: `${placements[widget].row} / span ${placements[widget].rowSpan}`,
                  }
            }
          >
            {renderWidget(widget)}
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
