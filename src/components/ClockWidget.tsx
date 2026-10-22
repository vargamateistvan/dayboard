import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { scheduleEverySecond } from '../lib/scheduleEverySecond'
import { useSettings } from '../lib/useSettings'
import { FixedWidthDigits } from './FixedWidthDigits'
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
  '--clock-time-fit-size'?: string
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

// One split-flap card. When the digit changes, the upper flap folds down to
// reveal the new digit while the lower flap swings into place over the old one.
function FlipDigit({ digit }: { readonly digit: string }) {
  const [current, setCurrent] = useState(digit)
  const [previous, setPrevious] = useState(digit)
  if (digit !== current) {
    setPrevious(current)
    setCurrent(digit)
  }

  return (
    <span className={styles.flipCard}>
      <span className={styles.flipTop}>
        <span className={styles.flipGlyph}>{current}</span>
      </span>
      <span className={styles.flipBottom}>
        <span className={styles.flipGlyph}>{previous}</span>
      </span>
      {previous !== current && (
        <span key={current} className={styles.flipFlaps}>
          <span className={[styles.flipTop, styles.flipTopFlap].join(' ')}>
            <span className={styles.flipGlyph}>{previous}</span>
          </span>
          <span
            className={[styles.flipBottom, styles.flipBottomFlap].join(' ')}
            onAnimationEnd={() => setPrevious(current)}
          >
            <span className={styles.flipGlyph}>{current}</span>
          </span>
        </span>
      )}
    </span>
  )
}

function FlipTime({ parts }: { readonly parts: Intl.DateTimeFormatPart[] }) {
  const text = parts.map((part) => part.value).join('')
  return (
    <span className={styles.flipTime} role="img" aria-label={text}>
      {parts.map((part, index) => {
        // Milliseconds change too fast to flip, so they sit beside the cards as plain digits.
        if (part.type === 'fractionalSecond') {
          return (
            <span key={index} className={styles.flipMillis} aria-hidden="true">
              <FixedWidthDigits text={part.value} />
            </span>
          )
        }
        // Every digit gets its own card; separators and AM/PM sit between them.
        if (/^\d+$/.test(part.value)) {
          return Array.from(part.value).map((digit, digitIndex) => (
            <FlipDigit key={`${index}-${digitIndex}`} digit={digit} />
          ))
        }
        return (
          <span key={index} className={styles.flipSeparator} aria-hidden="true">
            {part.value.trim()}
          </span>
        )
      })}
    </span>
  )
}

export function ClockWidget({ isFullscreen = false, rowCount = 3 }: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date())
  const { settings } = useSettings()
  const timeRef = useRef<HTMLDivElement | null>(null)
  const timeTextRef = useRef<HTMLSpanElement | null>(null)
  const [fitSize, setFitSize] = useState<number | null>(null)

  const showSeconds = settings.clockShowSeconds
  // Milliseconds only make sense next to seconds.
  const showMilliseconds = showSeconds && settings.clockShowMilliseconds

  useEffect(() => {
    if (showMilliseconds) {
      let frame = requestAnimationFrame(function tick() {
        setNow(new Date())
        frame = requestAnimationFrame(tick)
      })
      return () => cancelAnimationFrame(frame)
    }

    setNow(new Date())
    return scheduleEverySecond(() => setNow(new Date()))
  }, [showMilliseconds])

  const timeParts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    fractionalSecondDigits: showMilliseconds ? 3 : undefined,
  })
    .formatToParts(now)
    // Match toLocaleTimeString, which uses a plain space where Intl puts U+202F before AM/PM.
    .map((part) => ({ ...part, value: part.value.replace(/\u202f/g, ' ') }))
  const time = timeParts.map((part) => part.value).join('')

  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  // Cap the font size so the time never overflows its box, whatever the
  // configured size, row count or theme font.
  const timeLength = time.length
  useLayoutEffect(() => {
    const box = timeRef.current
    const text = timeTextRef.current
    if (!box || !text) {
      return undefined
    }

    const updateFitSize = () => {
      const textWidth = text.offsetWidth
      const boxWidth = box.clientWidth
      const fontSize = parseFloat(getComputedStyle(text).fontSize)
      if (!textWidth || !boxWidth || !fontSize) {
        return
      }
      const next = Math.floor((fontSize * boxWidth) / textWidth)
      setFitSize((current) => (current === next ? current : next))
    }

    updateFitSize()
    const resizeObserver = new ResizeObserver(updateFitSize)
    resizeObserver.observe(box)
    void document.fonts?.ready.then(updateFitSize)
    return () => resizeObserver.disconnect()
  }, [
    timeLength,
    settings.clockStyle,
    settings.clockTimeFontSizeRem,
    settings.clockTimeStretchPercent,
    rowCount,
    isFullscreen,
  ])

  const isFlip = settings.clockStyle === 'flip'

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
    '--clock-time-fit-size': fitSize == null ? undefined : `${fitSize}px`,
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')} style={style}>
      <div ref={timeRef} className={[styles.time, isFlip ? styles.timeFlip : ''].join(' ')}>
        <span ref={timeTextRef} className={styles.timeText}>
          {isFlip ? <FlipTime parts={timeParts} /> : <FixedWidthDigits text={time} />}
        </span>
      </div>
      <div className={styles.date}>{date}</div>
    </div>
  )
}
