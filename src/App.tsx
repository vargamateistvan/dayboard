import { useState, useEffect } from 'react'
import { Settings, Maximize2 } from 'lucide-react'
import { SettingsProvider } from './lib/useSettings'
import { useTheme } from './lib/useTheme'
import { useEventNotifications } from './lib/useEventNotifications'
import { useFocusMode } from './lib/useFocusMode'
import { useWidgetVisibility } from './lib/useWidgetVisibility'
import { ClockWidget } from './components/ClockWidget'
import { WeatherWidget } from './components/WeatherWidget'
import { CalendarWidget } from './components/CalendarWidget'
import { TimerPanel } from './components/TimerPanel'
import { TaskWidget } from './components/TaskWidget'
import { SettingsDialog } from './components/SettingsDialog'
import { NotificationBadge } from './components/NotificationBadge'
import './themes/base.css'
import './themes/default.css'
import './themes/retro.css'
import './themes/futuristic.css'
import './themes/nature.css'
import './themes/ocean.css'
import './themes/sunset.css'
import styles from './App.module.css'

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { effectiveTheme } = useTheme()
  const { notifications, dismissNotification } = useEventNotifications()
  const { focusMode, toggleFocusMode } = useFocusMode()
  const { visibility } = useWidgetVisibility()

  // Apply theme to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  return (
    <div className={`${styles.app} ${focusMode ? styles.focusMode : ''}`}>
      <button
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
      >
        <Settings size={18} />
      </button>

      <button
        className={`${styles.focusModeBtn} ${focusMode ? styles.active : ''}`}
        onClick={() => toggleFocusMode()}
        aria-label={`${focusMode ? 'Exit' : 'Enter'} focus mode`}
        title="Focus Mode (Cmd+K)"
      >
        <Maximize2 size={18} />
      </button>

      <main className={styles.main}>
        {visibility.clock && (
          <div className={styles.cellClock}>
            <ClockWidget />
          </div>
        )}
        {visibility.weather && !focusMode && (
          <div className={styles.cellWeather}>
            <WeatherWidget />
          </div>
        )}
        {visibility.calendar && !focusMode && (
          <div className={styles.cellCalendar}>
            <CalendarWidget />
          </div>
        )}
        {visibility.timer && (
          <div className={styles.cellTimer}>
            <TimerPanel />
          </div>
        )}
        {visibility.tasks && (
          <div className={styles.cellTasks}>
            <TaskWidget />
          </div>
        )}
      </main>

      <NotificationBadge notifications={notifications} onDismiss={dismissNotification} />
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
