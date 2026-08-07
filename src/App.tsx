import { useState } from 'react'
import { Settings } from 'lucide-react'
import { SettingsProvider } from './lib/useSettings'
import { ClockWidget } from './components/ClockWidget'
import { WeatherWidget } from './components/WeatherWidget'
import { CalendarWidget } from './components/CalendarWidget'
import { TimerPanel } from './components/TimerPanel'
import { SettingsDialog } from './components/SettingsDialog'
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

  return (
    <div className={styles.app}>
      <button
        className={styles.settingsBtn}
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        title="Settings"
      >
        <Settings size={18} />
      </button>

      <main className={styles.main}>
        <div className={styles.cellClock}>
          <ClockWidget />
        </div>
        <div className={styles.cellWeather}>
          <WeatherWidget />
        </div>
        <div className={styles.cellCalendar}>
          <CalendarWidget />
        </div>
        <div className={styles.cellTimer}>
          <TimerPanel />
        </div>
      </main>

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
