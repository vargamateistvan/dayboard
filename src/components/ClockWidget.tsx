import { useEffect, useState, type CSSProperties } from 'react'
import { useSettings } from '../lib/useSettings'
import styles from './ClockWidget.module.css'

interface ClockWidgetProps {
  readonly isFullscreen?: boolean
  readonly rowCount?: number
}

type ClockWidgetStyle = CSSProperties & {
  '--clock-time-size-auto'?: string
  '--clock-time-size-override'?: string
  '--clock-date-size-override'?: string
  '--clock-time-stretch'?: string
  '--clock-time-width-factor'?: string
}

function getClockTimeSize(rowCount: number): string | undefined {
  if (rowCount === 2) {
    return '22rem'
  }

  if (rowCount === 3) {
    return '16rem'
  }

  if (rowCount === 4) {
    return '11rem'
  }

  return undefined
}

export function ClockWidget({ isFullscreen = false, rowCount = 3 }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date())
  const { settings } = useSettings()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const style: ClockWidgetStyle = {
    '--clock-time-size-auto': getClockTimeSize(rowCount),
    '--clock-time-size-override':
      settings.clockTimeFontSizeRem == null ? undefined : `${settings.clockTimeFontSizeRem}rem`,
    '--clock-date-size-override':
      settings.clockDateFontSizeRem == null ? undefined : `${settings.clockDateFontSizeRem}rem`,
    '--clock-time-stretch':
      settings.clockTimeStretchPercent == null ? undefined : String(settings.clockTimeStretchPercent / 100),
    '--clock-time-width-factor':
      settings.clockTimeStretchPercent == null
        ? undefined
        : String(Math.max(settings.clockTimeStretchPercent / 100, 1)),
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')} style={style}>
      <div className={styles.time}>{time}</div>
      <div className={styles.date}>{date}</div>
    </div>
  )
}
