import { useEffect, useState } from 'react'
import { scheduleEverySecond } from '../lib/scheduleEverySecond'
import { getClockHourCycleOptions, type ClockHourFormat } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import { FixedWidthDigits } from './FixedWidthDigits'
import styles from './TimezoneClockWidget.module.css'

interface TimezoneClockWidgetProps {
  readonly isFullscreen?: boolean
}

function formatTime(now: Date, hourFormat: ClockHourFormat, timeZone?: string): string {
  return now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...getClockHourCycleOptions(hourFormat),
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
    return scheduleEverySecond(() => setNow(new Date()))
  }, [])

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.clockCard}>
        <div className={styles.clockHeader}>My location ({localTimeZone})</div>
        <div className={styles.time}>
          <FixedWidthDigits text={formatTime(now, settings.clockHourFormat)} />
        </div>
        <div className={styles.date}>{formatDate(now)}</div>
      </div>

      <div className={styles.clockCard}>
        <div className={styles.clockHeader}>
          {settings.worldClockCity} ({settings.worldClockTimeZone})
        </div>
        <div className={styles.time}>
          <FixedWidthDigits text={formatTime(now, settings.clockHourFormat, settings.worldClockTimeZone)} />
        </div>
        <div className={styles.date}>{formatDate(now, settings.worldClockTimeZone)}</div>
      </div>
    </div>
  )
}
