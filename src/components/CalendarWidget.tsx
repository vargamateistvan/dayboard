import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchCalendarFeeds, type FetchedCalendarFeed } from '../lib/fetchCalendarFeed'
import {
  parseCalendarFeed,
  type CalendarEvent,
  type CalendarPerson,
  type CalendarRange,
} from '../lib/parseCalendarFeed'
import { DEFAULT_CALENDAR_COLOR, type CalendarWeekStartsOn, mergeCalendarFeeds } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import styles from './CalendarWidget.module.css'

const WEEKDAY_LABELS_BY_START: Record<CalendarWeekStartsOn, string[]> = {
  monday: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  sunday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
}
const MONTH_GRID_DAY_COUNT = 42
const WEEK_DAY_COUNT = 7
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

interface WeekTimedEventSegment {
  event: CalendarEvent
  startMinute: number
  endMinute: number
  lane: number
  laneCount: number
}

interface WeekDaySchedule {
  date: Date
  isToday: boolean
  allDayEvents: CalendarEvent[]
  timedEvents: WeekTimedEventSegment[]
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

function formatWeekLabel(range: CalendarRange): string {
  const sameYear = range.start.getFullYear() === range.end.getFullYear()
  const sameMonth = sameYear && range.start.getMonth() === range.end.getMonth()

  const startLabel = range.start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const endLabel = range.end.toLocaleDateString(undefined, {
    ...(sameMonth ? {} : { month: 'short' }),
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })

  return `${startLabel} – ${endLabel}`
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

function getWeekRange(
  referenceDate: Date,
  weekStartsOn: CalendarWeekStartsOn,
): CalendarRange {
  const weekStart = new Date(referenceDate)
  weekStart.setDate(referenceDate.getDate() - getWeekOffset(referenceDate.getDay(), weekStartsOn))

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + WEEK_DAY_COUNT - 1)

  return {
    start: startOfDay(weekStart),
    end: endOfDay(weekEnd),
  }
}

function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function getMinutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
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

function buildWeekTimedEventSegments(
  events: Array<{ event: CalendarEvent; startMinute: number; endMinute: number }>,
): WeekTimedEventSegment[] {
  const sortedEvents = [...events].sort((a, b) => {
    if (a.startMinute === b.startMinute) {
      return a.endMinute - b.endMinute
    }
    return a.startMinute - b.startMinute
  })
  const lanesEndMinute: number[] = []

  const withLane = sortedEvents.map((entry) => {
    let lane = lanesEndMinute.findIndex((laneEndMinute) => laneEndMinute <= entry.startMinute)
    if (lane === -1) {
      lane = lanesEndMinute.length
      lanesEndMinute.push(entry.endMinute)
    } else {
      lanesEndMinute[lane] = entry.endMinute
    }

    return {
      ...entry,
      lane,
    }
  })

  const laneCount = Math.max(1, lanesEndMinute.length)

  return withLane.map((entry) => ({
    event: entry.event,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    lane: entry.lane,
    laneCount,
  }))
}

function buildWeekSchedule(referenceDate: Date, events: CalendarEvent[], weekStartsOn: CalendarWeekStartsOn): WeekDaySchedule[] {
  const weekRange = getWeekRange(referenceDate, weekStartsOn)
  const weekStart = startOfDay(weekRange.start)
  const todayKey = getDayKey(new Date())

  return Array.from({ length: WEEK_DAY_COUNT }, (_value, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const dayRange = getTodayRange(date)
    const dayStartMinute = getMinutesSinceStartOfDay(dayRange.start)
    const dayEndMinute = getMinutesSinceStartOfDay(dayRange.end)
    const dayEvents = events
      .filter((event) => isEventWithinRange(event, dayRange))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    const allDayEvents = dayEvents.filter((event) => event.allDay)
    const timedEvents = buildWeekTimedEventSegments(
      dayEvents
        .filter((event) => !event.allDay)
        .map((event) => {
          const clampedStart = event.start < dayRange.start ? dayRange.start : event.start
          const clampedEnd = event.end > dayRange.end ? dayRange.end : event.end
          const startMinute = Math.max(dayStartMinute, getMinutesSinceStartOfDay(clampedStart))
          const endMinute = Math.max(startMinute + 15, Math.min(dayEndMinute, getMinutesSinceStartOfDay(clampedEnd)))

          return {
            event,
            startMinute,
            endMinute,
          }
        }),
    )

    return {
      date,
      isToday: getDayKey(date) === todayKey,
      allDayEvents,
      timedEvents,
    }
  })
}

function resolveWeekHourRange(days: WeekDaySchedule[]): { startHour: number; endHour: number } {
  const startMinutes = days.flatMap((day) => day.timedEvents.map((event) => event.startMinute))
  const endMinutes = days.flatMap((day) => day.timedEvents.map((event) => event.endMinute))

  if (startMinutes.length === 0 || endMinutes.length === 0) {
    return { startHour: 8, endHour: 20 }
  }

  const minHour = Math.max(0, Math.floor(Math.min(...startMinutes) / 60) - 1)
  const maxHour = Math.min(24, Math.ceil(Math.max(...endMinutes) / 60) + 1)

  return {
    startHour: Math.min(minHour, 8),
    endHour: Math.max(maxHour, 20),
  }
}

function formatHourLabel(hour24: number): string {
  const date = new Date()
  date.setHours(hour24, 0, 0, 0)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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
  const [fetchedFeeds, setFetchedFeeds] = useState<FetchedCalendarFeed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [activeTooltip, setActiveTooltip] = useState<{
    event: CalendarEvent
    anchorElement: HTMLElement
  } | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>()
  const [activeMonthTooltip, setActiveMonthTooltip] = useState<ActiveMonthTooltip | null>(null)
  const [monthTooltipStyle, setMonthTooltipStyle] = useState<CSSProperties>()
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const monthTooltipRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const mergedCalendarFeeds = useMemo(
    () => mergeCalendarFeeds(settings.globalCalendarFeeds, settings.calendarFeeds),
    [settings.globalCalendarFeeds, settings.calendarFeeds],
  )
  const hasCalendarFeeds = mergedCalendarFeeds.length > 0
  const now = useMemo(() => new Date(), [])
  const weekdayLabels = WEEKDAY_LABELS_BY_START[settings.calendarWeekStartsOn]
  const monthGridRange = useMemo(
    () => getMonthGridRange(selectedDate, settings.calendarWeekStartsOn),
    [selectedDate, settings.calendarWeekStartsOn],
  )
  const showCalendarExtraInfo = settings.calendarShowMonthlyOverview
  const isWeeklyPreview = settings.calendarExtraInfoPreview === 'weekly'
  const weekRange = useMemo(
    () => getWeekRange(selectedDate, settings.calendarWeekStartsOn),
    [selectedDate, settings.calendarWeekStartsOn],
  )
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
    if (mergedCalendarFeeds.length === 0) {
      setFetchedFeeds([])
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

    fetchCalendarFeeds(mergedCalendarFeeds)
      .then((nextFetchedFeeds) => {
        if (cancelled) return
        setFetchedFeeds(nextFetchedFeeds)
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
  }, [mergedCalendarFeeds])

  useEffect(() => {
    if (fetchedFeeds.length === 0) {
      setEvents([])
      return
    }

    const nextEvents = fetchedFeeds
      .flatMap(({ feed, text }) => parseCalendarFeed(text, monthGridRange).map((event) => ({
        ...event,
        calendarColor: feed.color || DEFAULT_CALENDAR_COLOR,
      })))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    setEvents(nextEvents)
  }, [fetchedFeeds, monthGridRange])

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
    () => buildMonthCells(selectedDate, monthEventSummaries, settings.calendarWeekStartsOn),
    [monthEventSummaries, selectedDate, settings.calendarWeekStartsOn],
  )
  const monthLabel = formatMonthLabel(selectedDate)
  const { year, month } = formatMonthParts(selectedDate)
  const weekLabel = formatWeekLabel(weekRange)
  const weekSchedule = useMemo(
    () => buildWeekSchedule(selectedDate, monthEvents, settings.calendarWeekStartsOn),
    [selectedDate, monthEvents, settings.calendarWeekStartsOn],
  )
  const weekHourRange = useMemo(() => resolveWeekHourRange(weekSchedule), [weekSchedule])
  const weekHourTicks = useMemo(
    () =>
      Array.from(
        { length: weekHourRange.endHour - weekHourRange.startHour + 1 },
        (_value, index) => weekHourRange.startHour + index,
      ),
    [weekHourRange.endHour, weekHourRange.startHour],
  )
  const weekTotalMinutes = (weekHourRange.endHour - weekHourRange.startHour) * 60
  const isNowInWeek = now >= weekRange.start && now <= weekRange.end
  const currentTimePosition = isNowInWeek
    ? ((getMinutesSinceStartOfDay(now) - weekHourRange.startHour * 60) / weekTotalMinutes) * 100
    : null
  const weekTimelineStyle = {
    '--week-hour-count': String(Math.max(1, weekHourRange.endHour - weekHourRange.startHour)),
  } as CSSProperties
  const isMissingCalendarLinkError = error?.toLowerCase().includes('calendar link is missing') ?? false
  const previousPeriodLabel = isWeeklyPreview ? 'Previous week' : 'Previous month'
  const nextPeriodLabel = isWeeklyPreview ? 'Next week' : 'Next month'

  const goToPreviousPeriod = () => {
    setSelectedDate((currentDate) => {
      const nextDate = new Date(currentDate)
      if (isWeeklyPreview) {
        nextDate.setDate(currentDate.getDate() - WEEK_DAY_COUNT)
      } else {
        nextDate.setMonth(currentDate.getMonth() - 1)
      }
      return nextDate
    })
    setActiveMonthTooltip(null)
  }

  const goToNextPeriod = () => {
    setSelectedDate((currentDate) => {
      const nextDate = new Date(currentDate)
      if (isWeeklyPreview) {
        nextDate.setDate(currentDate.getDate() + WEEK_DAY_COUNT)
      } else {
        nextDate.setMonth(currentDate.getMonth() + 1)
      }
      return nextDate
    })
    setActiveMonthTooltip(null)
  }

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')} ref={widgetRef}>
      <div className={styles.header}>
        <span className={styles.title}>Calendar</span>
      </div>

      <div
        className={[
          styles.content,
          settings.calendarExtraInfoPreview === 'weekly' ? styles.contentWeekly : '',
          isFullscreen && !hasCalendarFeeds ? styles.contentNoFeedsFullscreen : '',
          isFullscreen && hasCalendarFeeds && visibleEvents.length === 0 ? styles.contentEmptyFullscreen : '',
          showCalendarExtraInfo ? '' : styles.contentFull,
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
              <p>{isMissingCalendarLinkError ? error : `Could not load calendar: ${error}`}</p>
              {!isMissingCalendarLinkError && (
                <p className={styles.hint}>
                  Tip: Dayboard retries with a proxy when it can, but some calendar hosts still block browser access.
                </p>
              )}
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

        {showCalendarExtraInfo && (
          <aside
            className={[
              styles.monthlyOverview,
              settings.calendarExtraInfoPreview === 'weekly' ? styles.weeklyOverview : '',
              isFullscreen && !hasCalendarFeeds ? styles.monthlyOverviewCentered : '',
            ].join(' ')}
            aria-label={settings.calendarExtraInfoPreview === 'weekly' ? 'Current week calendar' : 'Current month calendar'}
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLabel}>
                {settings.calendarExtraInfoPreview === 'weekly' ? (
                  <>
                    <span className={styles.monthName}>Week</span>
                    <span className={styles.monthYear}>{weekLabel}</span>
                    <span className={styles.monthLabelSrOnly}>{`Week of ${weekLabel}`}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.monthYear}>{year}.</span>
                    <span className={styles.monthName}>{month}</span>
                    <span className={styles.monthLabelSrOnly}>{monthLabel}</span>
                  </>
                )}
              </div>
              <div className={styles.sectionHeaderActions}>
                <button
                  className={styles.navButton}
                  onClick={goToPreviousPeriod}
                  aria-label={previousPeriodLabel}
                  type="button"
                >
                  <ChevronLeft size={14} />
                </button>
                {!isToday && (
                  <button
                    className={styles.todayButton}
                    onClick={() => { setSelectedDate(new Date()) }}
                    aria-label="Jump to today"
                    type="button"
                  >
                    Today
                  </button>
                )}
                <button
                  className={styles.navButton}
                  onClick={goToNextPeriod}
                  aria-label={nextPeriodLabel}
                  type="button"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {isWeeklyPreview ? (
              <>
                <div className={styles.weekTimeline}>
                  <div className={styles.weekTimelineScroll}>
                    <div className={styles.weekTimelineBody} style={weekTimelineStyle}>
                      <div className={styles.weekTimeAxis} aria-hidden="true">
                        <div className={styles.weekAllDayLabel}>all-day</div>
                        <div className={styles.weekTimeLabels}>
                          {weekHourTicks.map((hour, index) => (
                            <span
                              key={`week-hour-label-${hour}`}
                              className={styles.weekTimeLabel}
                              style={{ top: `${(index / Math.max(1, weekHourTicks.length - 1)) * 100}%` }}
                            >
                              {formatHourLabel(hour)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.weekScheduleGrid}>
                        {weekSchedule.map((day) => {
                          const isSelected = getDayKey(day.date) === getDayKey(selectedDate)
                          const dayLabel = day.date.toLocaleDateString(undefined, {
                            weekday: 'long',
                            day: 'numeric',
                          })

                          return (
                            <section
                              key={`week-schedule-${getDayKey(day.date)}`}
                              className={[
                                styles.weekDayColumn,
                                isSelected ? styles.weekDayColumnSelected : '',
                              ].join(' ')}
                              aria-label={`Schedule for ${day.date.toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                              })}`}
                            >
                              <button
                                className={styles.weekDayHeader}
                                onClick={() => {
                                  setSelectedDate(new Date(day.date))
                                  setActiveMonthTooltip(null)
                                }}
                                type="button"
                              >
                                <span className={styles.weekDayLabel}>{dayLabel}</span>
                              </button>
                              <div className={styles.weekAllDayEvents}>
                                {day.allDayEvents.length === 0 ? (
                                  <span className={styles.weekAllDayEmpty}>—</span>
                                ) : (
                                  day.allDayEvents.map((event) => {
                                    const hasTooltipDetails = hasEventTooltipDetails(event)

                                    return (
                                      <span
                                        key={`all-day-${getDayKey(day.date)}-${getEventKey(event)}`}
                                        className={styles.weekAllDayEvent}
                                        style={{ borderLeftColor: event.calendarColor ?? DEFAULT_CALENDAR_COLOR }}
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
                                      >
                                        {event.title}
                                      </span>
                                    )
                                  })
                                )}
                              </div>
                              <div className={styles.weekTimedArea}>
                                {weekHourTicks.map((hour, index) => (
                                  <span
                                    key={`week-hour-line-${getDayKey(day.date)}-${hour}`}
                                    className={styles.weekHourLine}
                                    style={{ top: `${(index / Math.max(1, weekHourTicks.length - 1)) * 100}%` }}
                                  />
                                ))}
                                {day.timedEvents.map((segment) => {
                                  const visibleStart = weekHourRange.startHour * 60
                                  const visibleEnd = weekHourRange.endHour * 60
                                  const start = Math.max(segment.startMinute, visibleStart)
                                  const end = Math.min(segment.endMinute, visibleEnd)
                                  const hasTooltipDetails = hasEventTooltipDetails(segment.event)

                                  if (end <= start) {
                                    return null
                                  }

                                  const top = ((start - visibleStart) / weekTotalMinutes) * 100
                                  const height = ((end - start) / weekTotalMinutes) * 100
                                  const width = 100 / segment.laneCount
                                  const left = segment.lane * width

                                  return (
                                    <article
                                      key={`timed-${getDayKey(day.date)}-${getEventKey(segment.event)}`}
                                      className={styles.weekTimedEvent}
                                      style={{
                                        top: `${top}%`,
                                        height: `${Math.max(height, 2.2)}%`,
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        borderLeftColor: segment.event.calendarColor ?? DEFAULT_CALENDAR_COLOR,
                                      }}
                                      onClick={() => setSelectedDate(new Date(day.date))}
                                      tabIndex={0}
                                      onMouseEnter={(currentEvent) => {
                                        if (!hasTooltipDetails) {
                                          return
                                        }

                                        setActiveTooltip({
                                          event: segment.event,
                                          anchorElement: currentEvent.currentTarget,
                                        })
                                      }}
                                      onMouseLeave={() => {
                                        setActiveTooltip((currentTooltip) =>
                                          currentTooltip?.event === segment.event ? null : currentTooltip,
                                        )
                                      }}
                                      onFocusCapture={(currentEvent) => {
                                        if (!hasTooltipDetails) {
                                          return
                                        }

                                        setActiveTooltip({
                                          event: segment.event,
                                          anchorElement: currentEvent.currentTarget,
                                        })
                                      }}
                                      onBlurCapture={(currentEvent) => {
                                        const nextFocusedElement = currentEvent.relatedTarget
                                        if (nextFocusedElement instanceof Node && currentEvent.currentTarget.contains(nextFocusedElement)) {
                                          return
                                        }

                                        setActiveTooltip((currentTooltip) =>
                                          currentTooltip?.event === segment.event ? null : currentTooltip,
                                        )
                                      }}
                                    >
                                      <span className={styles.weekTimedEventTime}>
                                        {segment.event.allDay
                                          ? 'All day'
                                          : `${formatTime(segment.event.start)} – ${formatTime(segment.event.end)}`}
                                      </span>
                                      <span className={styles.weekTimedEventTitle}>{segment.event.title}</span>
                                    </article>
                                  )
                                })}
                                {day.isToday && currentTimePosition != null && currentTimePosition >= 0 && currentTimePosition <= 100 && (
                                  <span
                                    className={styles.weekCurrentTimeLine}
                                    style={{ top: `${currentTimePosition}%` }}
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                            </section>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
