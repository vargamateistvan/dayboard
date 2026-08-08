import { useEffect, useMemo, useState } from 'react'
import { fetchCalendarFeeds } from '../lib/fetchCalendarFeed'
import { parseCalendarFeed, type CalendarEvent, type CalendarRange } from '../lib/parseCalendarFeed'
import { DEFAULT_CALENDAR_COLOR, type CalendarWeekStartsOn } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import styles from './CalendarWidget.module.css'

const WEEKDAY_LABELS_BY_START: Record<CalendarWeekStartsOn, string[]> = {
  monday: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  sunday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
}
const MONTH_GRID_DAY_COUNT = 42
const MAX_TOOLTIP_EVENTS = 4

interface MonthPreviewEvent {
  key: string
  timeLabel: string
  title: string
  color: string
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function formatMonthParts(date: Date): { year: string; month: string } {
  return {
    year: date.toLocaleDateString(undefined, { year: 'numeric' }),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function isEventWithinRange(event: CalendarEvent, range: CalendarRange): boolean {
  return event.start <= range.end && event.end >= range.start
}

function getTodayRange(date: Date): CalendarRange {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  }
}

function getWeekOffset(day: number, weekStartsOn: CalendarWeekStartsOn): number {
  return weekStartsOn === 'monday' ? (day + 6) % 7 : day
}

function getMonthGridRange(
  referenceDate: Date,
  weekStartsOn: CalendarWeekStartsOn,
): CalendarRange {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - getWeekOffset(monthStart.getDay(), weekStartsOn))

  const gridEnd = new Date(gridStart)
  gridEnd.setDate(gridStart.getDate() + MONTH_GRID_DAY_COUNT - 1)

  return {
    start: startOfDay(gridStart),
    end: endOfDay(gridEnd),
  }
}

function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function getEventKey(event: CalendarEvent): string {
  return `${event.title}-${event.start.getTime()}-${event.end.getTime()}-${event.allDay ? 'all-day' : 'timed'}`
}

function buildMonthPreviewEvent(event: CalendarEvent): MonthPreviewEvent {
  return {
    key: getEventKey(event),
    timeLabel: event.allDay ? 'All day' : `${formatTime(event.start)} - ${formatTime(event.end)}`,
    title: event.title,
    color: event.calendarColor ?? DEFAULT_CALENDAR_COLOR,
  }
}

function buildMonthEventSummaries(
  events: CalendarEvent[],
  range: CalendarRange,
): Map<string, { count: number; color: string; previewEvents: MonthPreviewEvent[] }> {
  const summaries = new Map<
    string,
    { count: number; color: string; previewEvents: MonthPreviewEvent[] }
  >()

  for (const event of events) {
    const clampedStart = event.start < range.start ? range.start : event.start
    const clampedEnd =
      event.end > range.end ? range.end : event.end
    const firstDay = startOfDay(clampedStart)
    const lastDay =
      clampedEnd.getTime() > clampedStart.getTime()
        ? startOfDay(new Date(clampedEnd.getTime() - 1))
        : firstDay

    for (
      let cursor = new Date(firstDay);
      cursor <= lastDay;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const dayKey = getDayKey(cursor)
      const summary = summaries.get(dayKey)

      summaries.set(dayKey, {
        count: (summary?.count ?? 0) + 1,
        color: summary?.color ?? event.calendarColor ?? DEFAULT_CALENDAR_COLOR,
        previewEvents: [...(summary?.previewEvents ?? []), buildMonthPreviewEvent(event)],
      })
    }
  }

  return summaries
}

function buildMonthCells(
  referenceDate: Date,
  eventSummaries: Map<string, { count: number; color: string; previewEvents: MonthPreviewEvent[] }>,
  weekStartsOn: CalendarWeekStartsOn,
) {
  const today = startOfDay(referenceDate)
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - getWeekOffset(monthStart.getDay(), weekStartsOn))

  return Array.from({ length: MONTH_GRID_DAY_COUNT }, (_value, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dayKey = getDayKey(date)

    return {
      date,
      inCurrentMonth: date.getMonth() === referenceDate.getMonth(),
      isToday: dayKey === getDayKey(today),
      eventCount: eventSummaries.get(dayKey)?.count ?? 0,
      eventColor: eventSummaries.get(dayKey)?.color ?? DEFAULT_CALENDAR_COLOR,
      previewEvents: eventSummaries.get(dayKey)?.previewEvents ?? [],
    }
  })
}

export function CalendarWidget() {
  const { settings } = useSettings()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasCalendarFeeds = settings.calendarFeeds.length > 0
  const now = new Date()
  const weekdayLabels = WEEKDAY_LABELS_BY_START[settings.calendarWeekStartsOn]
  const monthGridRange = useMemo(
    () => getMonthGridRange(now, settings.calendarWeekStartsOn),
    [now.getFullYear(), now.getMonth(), settings.calendarWeekStartsOn],
  )
  const todayRange = useMemo(() => getTodayRange(now), [now.getFullYear(), now.getMonth(), now.getDate()])

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
          .flatMap(({ feed, text }) => parseCalendarFeed(text, monthGridRange).map((event) => ({
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
  }, [monthGridRange, settings.calendarFeeds])

  const todaysEvents = events.filter((event) => isEventWithinRange(event, todayRange))
  const visibleEvents = todaysEvents.filter((event) => {
    if (!settings.calendarShowAllDayEvents && event.allDay) {
      return false
    }

    if (settings.calendarHidePastEvents && event.end <= now) {
      return false
    }

    return true
  })
  const currentEvents = new Set(
    visibleEvents
      .filter((event) => event.start <= now && event.end > now)
      .map(getEventKey),
  )
  const nextEvent = visibleEvents.find((event) => event.start > now)
  const nextEventKey = nextEvent ? getEventKey(nextEvent) : null
  const monthEvents = events.filter((event) => {
    if (!settings.calendarShowAllDayEvents && event.allDay) {
      return false
    }

    return true
  })
  const monthEventSummaries = useMemo(
    () => buildMonthEventSummaries(monthEvents, monthGridRange),
    [monthEvents, monthGridRange],
  )
  const monthCells = useMemo(
    () => buildMonthCells(now, monthEventSummaries, settings.calendarWeekStartsOn),
    [monthEventSummaries, now, settings.calendarWeekStartsOn],
  )
  const monthLabel = formatMonthLabel(now)
  const { year, month } = formatMonthParts(now)

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Calendar</span>
      </div>

      <div
        className={[
          styles.content,
          settings.calendarShowMonthlyOverview ? '' : styles.contentFull,
        ].join(' ')}
      >
        <section className={styles.eventsColumn}>
          {!hasCalendarFeeds && (
            <div className={styles.empty}>
              No calendars connected.{` `}
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

          {hasCalendarFeeds && !loading && !error && visibleEvents.length === 0 && (
            <div className={styles.empty}>No events today ✓</div>
          )}

          {hasCalendarFeeds && !loading && !error && visibleEvents.length > 0 && (
            <ul className={styles.list}>
              {visibleEvents.map((event) => {
                const eventKey = getEventKey(event)
                const isCurrent = currentEvents.has(eventKey)
                const isNext = eventKey === nextEventKey
                const isPast = event.end < now

                return (
                  <li
                    key={eventKey}
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
        </section>

        {settings.calendarShowMonthlyOverview && (
          <aside className={styles.monthlyOverview} aria-label="Current month calendar">
            <div className={styles.sectionHeader}>
              <span className={styles.monthYear}>{year}.</span>
              <span className={styles.monthName}>{month}</span>
              <span className={styles.monthLabelSrOnly}>{monthLabel}</span>
            </div>

            <div className={styles.weekdayRow} aria-hidden="true">
              {weekdayLabels.map((label, index) => (
                <span key={`${label}-${index}`} className={styles.weekdayLabel}>
                  {label}
                </span>
              ))}
            </div>

            <div className={styles.monthGrid}>
              {monthCells.map((cell) => (
                <div
                  key={getDayKey(cell.date)}
                  className={[
                    styles.monthCell,
                    cell.inCurrentMonth ? '' : styles.monthCellMuted,
                    cell.isToday ? styles.monthCellToday : '',
                    cell.eventCount > 0 ? styles.monthCellHasEvent : '',
                  ].join(' ')}
                  aria-label={cell.date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  tabIndex={cell.previewEvents.length > 0 ? 0 : undefined}
                >
                  <span className={styles.monthCellNumber}>{cell.date.getDate()}</span>
                  {cell.eventCount > 0 && (
                    <>
                      <span
                        className={styles.monthEventBar}
                        aria-hidden="true"
                        style={{ backgroundColor: cell.eventColor }}
                      />
                      {cell.eventCount > 1 && (
                        <span className={styles.monthEventCount}>+{cell.eventCount - 1}</span>
                      )}
                      <div className={styles.monthTooltip} role="tooltip">
                        <div className={styles.monthTooltipHeader}>
                          {cell.date.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <ul className={styles.monthTooltipList}>
                          {cell.previewEvents
                            .slice(0, MAX_TOOLTIP_EVENTS)
                            .map((previewEvent) => (
                              <li key={previewEvent.key} className={styles.monthTooltipItem}>
                                <span
                                  className={styles.monthTooltipDot}
                                  aria-hidden="true"
                                  style={{ backgroundColor: previewEvent.color }}
                                />
                                <div className={styles.monthTooltipContent}>
                                  <span className={styles.monthTooltipTime}>
                                    {previewEvent.timeLabel}
                                  </span>
                                  <span className={styles.monthTooltipTitle}>
                                    {previewEvent.title}
                                  </span>
                                </div>
                              </li>
                            ))}
                          {cell.eventCount > MAX_TOOLTIP_EVENTS && (
                            <li className={styles.monthTooltipMore}>
                              +{cell.eventCount - MAX_TOOLTIP_EVENTS} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
