import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { fetchCalendarFeeds } from '../lib/fetchCalendarFeed'
import {
  parseCalendarFeed,
  type CalendarEvent,
  type CalendarPerson,
  type CalendarRange,
} from '../lib/parseCalendarFeed'
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

interface ActiveMonthTooltip {
  dayLabel: string
  previewEvents: MonthPreviewEvent[]
  extraCount: number
  anchorElement: HTMLDivElement
}

interface CalendarWidgetProps {
  readonly isFullscreen?: boolean
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

function getFloatingTooltipStyle(
  anchorRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  gap = 10,
  viewportPadding = 12,
): CSSProperties {
  let left = anchorRect.left - tooltipWidth - gap
  if (left < viewportPadding) {
    left = anchorRect.right + gap
  }
  if (left + tooltipWidth > window.innerWidth - viewportPadding) {
    left = Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding)
  }

  let top = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2
  if (top < viewportPadding) {
    top = viewportPadding
  }
  if (top + tooltipHeight > window.innerHeight - viewportPadding) {
    top = window.innerHeight - tooltipHeight - viewportPadding
  }

  return { left, top }
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

function formatResponseStatus(status: string | undefined): string | null {
  if (!status) {
    return null
  }

  switch (status) {
    case 'ACCEPTED':
      return 'Accepted'
    case 'DECLINED':
      return 'Declined'
    case 'TENTATIVE':
      return 'Tentative'
    case 'NEEDS-ACTION':
      return 'Awaiting reply'
    default:
      return status
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' ')
  }
}

function formatPerson(person: CalendarPerson): string {
  return person.email ? `${person.name} <${person.email}>` : person.name
}

function hasEventTooltipDetails(event: CalendarEvent): boolean {
  return Boolean(event.location || event.notes || event.organizer || event.attendees?.length)
}

function EventDetailsTooltipContent({ event }: Readonly<{ event: CalendarEvent }>) {
  const hasGuests = Boolean(event.attendees && event.attendees.length > 0)

  return (
    <>
      <div className={styles.eventTooltipHeader}>
        <span className={styles.eventTooltipTitle}>{event.title}</span>
        <span className={styles.eventTooltipTime}>
          {event.allDay ? 'All day' : `${formatTime(event.start)} - ${formatTime(event.end)}`}
        </span>
      </div>

      <div className={styles.eventTooltipBody}>
        {event.location && (
          <div className={styles.eventTooltipSection}>
            <span className={styles.eventTooltipLabel}>Location</span>
            <span className={styles.eventTooltipValue}>{event.location}</span>
          </div>
        )}

        {event.organizer && (
          <div className={styles.eventTooltipSection}>
            <span className={styles.eventTooltipLabel}>Host</span>
            <span className={styles.eventTooltipValue}>{formatPerson(event.organizer)}</span>
          </div>
        )}

        {hasGuests && (
          <div className={styles.eventTooltipSection}>
            <span className={styles.eventTooltipLabel}>Guests</span>
            <ul className={styles.eventTooltipPeople}>
              {event.attendees?.map((attendee) => {
                const responseStatus = formatResponseStatus(attendee.responseStatus)

                return (
                  <li key={`${attendee.name}-${attendee.email ?? 'no-email'}`} className={styles.eventTooltipPerson}>
                    <span className={styles.eventTooltipValue}>{formatPerson(attendee)}</span>
                    {responseStatus && (
                      <span className={styles.eventTooltipBadge}>{responseStatus}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {event.notes && (
          <div className={styles.eventTooltipSection}>
            <span className={styles.eventTooltipLabel}>Notes</span>
            <p className={styles.eventTooltipNotes}>{event.notes}</p>
          </div>
        )}

        {event.eventUrl && (
          <div className={styles.eventTooltipSection}>
            <span className={styles.eventTooltipLabel}>Invite</span>
            <span className={styles.eventTooltipValue}>{event.eventUrl}</span>
          </div>
        )}
      </div>
    </>
  )
}

function MonthTooltipContent({
  dayLabel,
  previewEvents,
  extraCount,
}: Readonly<Pick<ActiveMonthTooltip, 'dayLabel' | 'previewEvents' | 'extraCount'>>) {
  return (
    <>
      <div className={styles.monthTooltipHeader}>{dayLabel}</div>
      <ul className={styles.monthTooltipList}>
        {previewEvents.slice(0, MAX_TOOLTIP_EVENTS).map((previewEvent) => (
          <li key={previewEvent.key} className={styles.monthTooltipItem}>
            <span
              className={styles.monthTooltipDot}
              aria-hidden="true"
              style={{ backgroundColor: previewEvent.color }}
            />
            <div className={styles.monthTooltipContent}>
              <span className={styles.monthTooltipTime}>{previewEvent.timeLabel}</span>
              <span className={styles.monthTooltipTitle}>{previewEvent.title}</span>
            </div>
          </li>
        ))}
        {extraCount > 0 && <li className={styles.monthTooltipMore}>+{extraCount} more</li>}
      </ul>
    </>
  )
}

export function CalendarWidget({ isFullscreen = false }: CalendarWidgetProps) {
  const { settings } = useSettings()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [activeTooltip, setActiveTooltip] = useState<{
    event: CalendarEvent
    anchorElement: HTMLLIElement
  } | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>()
  const [activeMonthTooltip, setActiveMonthTooltip] = useState<ActiveMonthTooltip | null>(null)
  const [monthTooltipStyle, setMonthTooltipStyle] = useState<CSSProperties>()
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const monthTooltipRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const hasCalendarFeeds = settings.calendarFeeds.length > 0
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const weekdayLabels = WEEKDAY_LABELS_BY_START[settings.calendarWeekStartsOn]
  const monthGridRange = useMemo(() => getMonthGridRange(now, settings.calendarWeekStartsOn), [nowYear, nowMonth, settings.calendarWeekStartsOn])
  const selectedRange = useMemo(() => getTodayRange(selectedDate), [selectedDate])
  const isToday = getDayKey(selectedDate) === getDayKey(now)

  useEffect(() => {
    if (!activeTooltip) {
      setTooltipStyle(undefined)
      return
    }

    const updateTooltipPosition = () => {
      const anchorRect = activeTooltip.anchorElement.getBoundingClientRect()
      const tooltipRect = tooltipRef.current?.getBoundingClientRect()

      const tooltipWidth = tooltipRect?.width ?? 304
      const tooltipHeight = tooltipRect?.height ?? 220
      setTooltipStyle(getFloatingTooltipStyle(anchorRect, tooltipWidth, tooltipHeight))
    }

    updateTooltipPosition()

    const handleViewportChange = () => {
      updateTooltipPosition()
    }

    const currentList = listRef.current
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    currentList?.addEventListener('scroll', handleViewportChange)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      currentList?.removeEventListener('scroll', handleViewportChange)
    }
  }, [activeTooltip])

  useEffect(() => {
    if (!activeMonthTooltip) {
      setMonthTooltipStyle(undefined)
      return
    }

    const updateMonthTooltipPosition = () => {
      const anchorRect = activeMonthTooltip.anchorElement.getBoundingClientRect()
      const tooltipRect = monthTooltipRef.current?.getBoundingClientRect()
      const tooltipWidth = tooltipRect?.width ?? 192
      const tooltipHeight = tooltipRect?.height ?? 180
      setMonthTooltipStyle(getFloatingTooltipStyle(anchorRect, tooltipWidth, tooltipHeight))
    }

    updateMonthTooltipPosition()

    const handleViewportChange = () => {
      updateMonthTooltipPosition()
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [activeMonthTooltip])

  useEffect(() => {
    if (settings.calendarFeeds.length === 0) {
      setEvents([])
      setError(null)
      setLoading(false)
      setActiveTooltip(null)
      setActiveMonthTooltip(null)
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

  const todaysEvents = events.filter((event) => isEventWithinRange(event, selectedRange))
  const visibleEvents = todaysEvents.filter((event) => {
    if (!settings.calendarShowAllDayEvents && event.allDay) {
      return false
    }

    if (settings.calendarHidePastEvents && isToday && event.end <= now) {
      return false
    }

    return true
  })
  const currentEvents = new Set(
    isToday
      ? visibleEvents.filter((event) => event.start <= now && event.end > now).map(getEventKey)
      : [],
  )
  const nextEvent = isToday ? visibleEvents.find((event) => event.start > now) : null
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
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')} ref={widgetRef}>
      <div className={styles.header}>
        <span className={styles.title}>Calendar</span>
      </div>

      <div
        className={[
          styles.content,
          isFullscreen && !hasCalendarFeeds ? styles.contentNoFeedsFullscreen : '',
          isFullscreen && hasCalendarFeeds && visibleEvents.length === 0 ? styles.contentEmptyFullscreen : '',
          settings.calendarShowMonthlyOverview ? '' : styles.contentFull,
        ].join(' ')}
      >
        <section
          className={[
            styles.eventsColumn,
            isFullscreen && !hasCalendarFeeds ? styles.eventsColumnCentered : '',
            isFullscreen && hasCalendarFeeds && visibleEvents.length === 0 ? styles.eventsColumnCentered : '',
          ].join(' ')}
        >
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
            <div className={styles.empty}>
              {isToday ? 'No events today ✓' : 'No events on this day'}
            </div>
          )}

          {hasCalendarFeeds && !loading && !error && visibleEvents.length > 0 && (
            <ul className={styles.list} ref={listRef}>
              {visibleEvents.map((event) => {
                const eventKey = getEventKey(event)
                const isCurrent = currentEvents.has(eventKey)
                const isNext = eventKey === nextEventKey
                const isPast = event.end < now
                const hasTooltipDetails = hasEventTooltipDetails(event)

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
                    onMouseEnter={(currentEvent) => {
                      if (!hasTooltipDetails) {
                        return
                      }

                      setActiveTooltip({ event, anchorElement: currentEvent.currentTarget })
                    }}
                    onMouseLeave={() => {
                      setActiveTooltip((currentTooltip) =>
                        currentTooltip?.event === event ? null : currentTooltip,
                      )
                    }}
                    onFocusCapture={(currentEvent) => {
                      if (!hasTooltipDetails) {
                        return
                      }

                      setActiveTooltip({ event, anchorElement: currentEvent.currentTarget })
                    }}
                    onBlurCapture={(currentEvent) => {
                      const nextFocusedElement = currentEvent.relatedTarget
                      if (nextFocusedElement instanceof Node && currentEvent.currentTarget.contains(nextFocusedElement)) {
                        return
                      }

                      setActiveTooltip((currentTooltip) =>
                        currentTooltip?.event === event ? null : currentTooltip,
                      )
                    }}
                  >
                    <div className={styles.eventTime}>
                      {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
                    </div>
                    <div className={styles.eventTitle}>
                      {isCurrent && <span className={styles.currentBadge}>Now</span>}
                      {isNext && <span className={styles.nextBadge}>Next</span>}
                      {event.title}
                    </div>
                    {event.eventUrl && (
                      <div className={styles.eventMeta}>
                        <a
                          className={styles.eventLink}
                          href={event.eventUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open link for ${event.title}`}
                        >
                          <span className={styles.eventLinkText}>Open link</span>
                        </a>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {settings.calendarShowMonthlyOverview && (
          <aside
            className={[
              styles.monthlyOverview,
              isFullscreen && !hasCalendarFeeds ? styles.monthlyOverviewCentered : '',
            ].join(' ')}
            aria-label="Current month calendar"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLabel}>
                <span className={styles.monthYear}>{year}.</span>
                <span className={styles.monthName}>{month}</span>
                <span className={styles.monthLabelSrOnly}>{monthLabel}</span>
              </div>
              {!isToday && (
                <button
                  className={styles.todayButton}
                  onClick={() => { setSelectedDate(new Date()) }}
                  aria-label="Jump to today"
                >
                  Today
                </button>
              )}
            </div>

            <div className={styles.weekdayRow} aria-hidden="true">
              {weekdayLabels.map((label, index) => (
                <span key={`${label}-${index}`} className={styles.weekdayLabel}>
                  {label}
                </span>
              ))}
            </div>

            <div className={styles.monthGrid}>
              {monthCells.map((cell) => {
                const isSelected = getDayKey(cell.date) === getDayKey(selectedDate)

                return (
                <div
                  key={getDayKey(cell.date)}
                  className={[
                    styles.monthCell,
                    cell.inCurrentMonth ? '' : styles.monthCellMuted,
                    cell.isToday ? styles.monthCellToday : '',
                    cell.eventCount > 0 ? styles.monthCellHasEvent : '',
                    isSelected && !cell.isToday ? styles.monthCellSelected : '',
                  ].join(' ')}
                  aria-label={cell.date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  aria-current={cell.isToday ? 'date' : undefined}
                  tabIndex={0}
                  role="button"
                  onClick={() => {
                    setSelectedDate(new Date(cell.date))
                    setActiveMonthTooltip(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedDate(new Date(cell.date))
                      setActiveMonthTooltip(null)
                    }
                  }}
                  onMouseEnter={(currentEvent) => {
                    if (cell.previewEvents.length === 0) {
                      return
                    }

                    setActiveMonthTooltip({
                      dayLabel: cell.date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      }),
                      previewEvents: cell.previewEvents,
                      extraCount: Math.max(0, cell.eventCount - MAX_TOOLTIP_EVENTS),
                      anchorElement: currentEvent.currentTarget,
                    })
                  }}
                  onMouseLeave={(currentEvent) => {
                    setActiveMonthTooltip((currentTooltip) =>
                      currentTooltip?.anchorElement === currentEvent.currentTarget &&
                        document.activeElement === currentEvent.currentTarget
                        ? currentTooltip
                        : null,
                    )
                  }}
                  onFocusCapture={(currentEvent) => {
                    if (cell.previewEvents.length === 0) {
                      return
                    }

                    setActiveMonthTooltip({
                      dayLabel: cell.date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      }),
                      previewEvents: cell.previewEvents,
                      extraCount: Math.max(0, cell.eventCount - MAX_TOOLTIP_EVENTS),
                      anchorElement: currentEvent.currentTarget,
                    })
                  }}
                  onBlurCapture={(currentEvent) => {
                    const nextFocusedElement = currentEvent.relatedTarget
                    if (nextFocusedElement instanceof Node && currentEvent.currentTarget.contains(nextFocusedElement)) {
                      return
                    }

                    setActiveMonthTooltip((currentTooltip) =>
                      currentTooltip?.anchorElement === currentEvent.currentTarget ? null : currentTooltip,
                    )
                  }}
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
                    </>
                  )}
                </div>
                )
              })}
            </div>
          </aside>
        )}
      </div>
      {activeTooltip && tooltipStyle && createPortal(
        <div
          ref={tooltipRef}
          className={[styles.eventTooltip, styles.eventTooltipFloating].join(' ')}
          style={tooltipStyle}
          role="tooltip"
        >
          <EventDetailsTooltipContent event={activeTooltip.event} />
        </div>,
        document.body,
      )}
      {activeMonthTooltip && monthTooltipStyle && createPortal(
        <div
          ref={monthTooltipRef}
          className={[styles.monthTooltip, styles.monthTooltipFloating].join(' ')}
          style={monthTooltipStyle}
          role="tooltip"
        >
          <MonthTooltipContent
            dayLabel={activeMonthTooltip.dayLabel}
            previewEvents={activeMonthTooltip.previewEvents}
            extraCount={activeMonthTooltip.extraCount}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}
