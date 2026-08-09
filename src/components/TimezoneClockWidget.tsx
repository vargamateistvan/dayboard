import { useEffect, useState } from 'react'
import { useSettings } from '../lib/useSettings'
import styles from './TimezoneClockWidget.module.css'

interface TimezoneClockWidgetProps {
  readonly isFullscreen?: boolean
}

function formatTime(now: Date, timeZone?: string): string {
  return now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
}

function formatDate(now: Date, timeZone?: string): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
}

export function TimezoneClockWidget({ isFullscreen = false }: TimezoneClockWidgetProps) {
  const [now, setNow] = useState(() => new Date())
  const { settings } = useSettings()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.clockCard}>
        <div className={styles.clockHeader}>My location ({localTimeZone})</div>
        <div className={styles.time}>{formatTime(now)}</div>
        <div className={styles.date}>{formatDate(now)}</div>
      </div>

      <div className={styles.clockCard}>
        <div className={styles.clockHeader}>
          {settings.worldClockCity} ({settings.worldClockTimeZone})
        </div>
        <div className={styles.time}>{formatTime(now, settings.worldClockTimeZone)}</div>
        <div className={styles.date}>{formatDate(now, settings.worldClockTimeZone)}</div>
      </div>
    </div>
  )
}
