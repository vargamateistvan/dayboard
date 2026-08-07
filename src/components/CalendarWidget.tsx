import { useEffect, useState } from 'react'
import { parseCalendarFeed, type CalendarEvent } from '../lib/parseCalendarFeed'
import { useSettings } from '../lib/useSettings'
import styles from './CalendarWidget.module.css'

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function CalendarWidget() {
  const { settings } = useSettings()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = settings.calendarUrl.trim()
    if (!url) {
      setEvents([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        if (cancelled) return
        setEvents(parseCalendarFeed(text))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError((err as Error).message ?? 'Could not load calendar.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [settings.calendarUrl])

  const now = new Date()
  const nextEvent = events.find((e) => e.end > now)

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Today's Events</span>
      </div>

      {!settings.calendarUrl && (
        <div className={styles.empty}>
          No calendar connected.{' '}
          <span className={styles.hint}>Add a calendar URL in settings.</span>
        </div>
      )}

      {settings.calendarUrl && loading && (
        <div className={styles.loading} aria-label="Loading events">Loading…</div>
      )}

      {settings.calendarUrl && !loading && error && (
        <div className={styles.error}>
          <p>Could not load calendar: {error}</p>
          <p className={styles.hint}>
            Tip: Some calendars block browser requests due to CORS. Try a public proxy URL.
          </p>
        </div>
      )}

      {settings.calendarUrl && !loading && !error && events.length === 0 && (
        <div className={styles.empty}>No events today 🎉</div>
      )}

      {settings.calendarUrl && !loading && !error && events.length > 0 && (
        <ul className={styles.list}>
          {events.map((event, i) => {
            const isNext = event === nextEvent
            const isPast = event.end < now
            return (
              <li
                key={i}
                className={[
                  styles.event,
                  isNext ? styles.next : '',
                  isPast ? styles.past : '',
                ].join(' ')}
              >
                <div className={styles.eventTime}>
                  {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
                </div>
                <div className={styles.eventTitle}>
                  {isNext && <span className={styles.nextBadge}>Next</span>}
                  {event.title}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
