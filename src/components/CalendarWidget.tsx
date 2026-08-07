import { useEffect, useState } from 'react'
import { fetchCalendarFeeds } from '../lib/fetchCalendarFeed'
import { parseCalendarFeed, type CalendarEvent } from '../lib/parseCalendarFeed'
import { DEFAULT_CALENDAR_COLOR } from '../lib/settings'
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
  const hasCalendarFeeds = settings.calendarFeeds.length > 0

  useEffect(() => {
   if (settings.calendarFeeds.length === 0) {
      setEvents([])
      setError(null)
     setLoading(false)
     return
   }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchCalendarFeeds(settings.calendarFeeds)
      .then((feeds) => {
        if (cancelled) return
        const nextEvents = feeds
          .flatMap(({ feed, text }) => parseCalendarFeed(text).map((event) => ({
            ...event,
            calendarColor: feed.color || DEFAULT_CALENDAR_COLOR,
          })))
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
  }, [settings.calendarFeeds])

  const now = new Date()
  const currentEvents = events.filter((e) => e.start <= now && e.end > now)
  const nextEvent = events.find((e) => e.start > now)

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Today's Events</span>
      </div>

      {!hasCalendarFeeds && (
        <div className={styles.empty}>
          No calendars connected.{' '}
          <span className={styles.hint}>Add one or more calendar links in settings.</span>
        </div>
      )}

      {hasCalendarFeeds && loading && (
        <div className={styles.loading} aria-label="Loading events">Loading…</div>
      )}

      {hasCalendarFeeds && !loading && error && (
        <div className={styles.error}>
          <p>Could not load calendar: {error}</p>
          <p className={styles.hint}>
            Tip: Dayboard retries with a proxy when it can, but some calendar hosts still block browser access.
          </p>
        </div>
      )}

      {hasCalendarFeeds && !loading && !error && events.length === 0 && (
        <div className={styles.empty}>No events today ✓</div>
      )}

      {hasCalendarFeeds && !loading && !error && events.length > 0 && (
        <ul className={styles.list}>
          {events.map((event, i) => {
            const isCurrent = currentEvents.includes(event)
            const isNext = event === nextEvent
            const isPast = event.end < now
            return (
              <li
                key={i}
                className={[
                  styles.event,
                  isCurrent ? styles.current : '',
                  isNext ? styles.next : '',
                  isPast ? styles.past : '',
                ].join(' ')}
                style={{ color: event.calendarColor ?? DEFAULT_CALENDAR_COLOR }}
              >
                <div className={styles.eventTime}>
                  {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
                </div>
                <div className={styles.eventTitle}>
                  {isCurrent && <span className={styles.currentBadge}>Now</span>}
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
