import { useEffect, useState } from 'react'
import { fetchCalendarFeeds } from '../lib/fetchCalendarFeed'
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
  const hasCalendarUrls = settings.calendarUrls.length > 0

  useEffect(() => {
    if (settings.calendarUrls.length === 0) {
      setEvents([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchCalendarFeeds(settings.calendarUrls)
      .then((texts) => {
        if (cancelled) return
        const nextEvents = texts
          .flatMap((text) => parseCalendarFeed(text))
          .sort((a, b) => a.start.getTime() - b.start.getTime())
        setEvents(nextEvents)
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
  }, [settings.calendarUrls])

  const now = new Date()
  const nextEvent = events.find((e) => e.end > now)

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Today's Events</span>
      </div>

      {!hasCalendarUrls && (
        <div className={styles.empty}>
          No calendars connected.{' '}
          <span className={styles.hint}>Add one or more calendar links in settings.</span>
        </div>
      )}

      {hasCalendarUrls && loading && (
        <div className={styles.loading} aria-label="Loading events">Loading…</div>
      )}

      {hasCalendarUrls && !loading && error && (
        <div className={styles.error}>
          <p>Could not load calendar: {error}</p>
          <p className={styles.hint}>
            Tip: Dayboard retries with a proxy when it can, but some calendar hosts still block browser access.
          </p>
        </div>
      )}

      {hasCalendarUrls && !loading && !error && events.length === 0 && (
        <div className={styles.empty}>No events today ✓</div>
      )}

      {hasCalendarUrls && !loading && !error && events.length > 0 && (
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
