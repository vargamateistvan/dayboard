import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MinusCircle, Plus } from 'lucide-react'
import { getSubsolarPoint, type GeoPoint } from '../lib/celestial'
import { scheduleEverySecond } from '../lib/scheduleEverySecond'
import type { ClockHourFormat } from '../lib/settings'
import { useSettings } from '../lib/useSettings'
import {
  buildMapDotPaths,
  buildTerminatorPath,
  formatCityTime,
  formatHourOffset,
  formatRelativeDay,
  getRelativeDay,
  getSunTimes,
  getTimeZoneOffsetMinutes,
  getZonedTime,
  isDaylight,
  layoutMapLabels,
  projectToMap,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
  type ZonedTime,
} from '../lib/worldClock'
import { getWorldClockCity, type WorldClockCity } from '../lib/worldClockCities'
import { WorldClockCityPicker } from './WorldClockCityPicker'
import styles from './TimezoneClockWidget.module.css'

interface TimezoneClockWidgetProps {
  readonly isFullscreen?: boolean
}

const MINUTE_MS = 60_000
const RAD = Math.PI / 180
const HOUR_NUMERALS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
// Label box estimates in ems of the map font; they only need to be close
// enough to keep neighbouring labels from overlapping.
const LABEL_CHAR_WIDTH_EM = 0.6
const LABEL_HEIGHT_EM = 2.3
const LABEL_GAP_EM = 0.6
const MARKER_RADIUS_EM = 0.4

const LABEL_SIDE_CLASSES: Record<'right' | 'left' | 'below' | 'above', string> = {
  right: '',
  left: styles.markerLabelLeft,
  below: styles.markerLabelBelow,
  above: styles.markerLabelAbove,
}

function AnalogClock({ time, isDay }: { readonly time: ZonedTime; readonly isDay: boolean }) {
  const secondAngle = time.second * 6
  const minuteAngle = time.minute * 6 + time.second * 0.1
  const hourAngle = (time.hour % 12) * 30 + time.minute * 0.5

  return (
    <svg
      className={[styles.face, isDay ? styles.faceDay : styles.faceNight].join(' ')}
      viewBox="-50 -50 100 100"
      aria-hidden="true"
    >
      <circle className={styles.dial} r={49} />
      {HOUR_NUMERALS.map((numeral) => (
        <text
          key={numeral}
          className={styles.numeral}
          x={(37 * Math.sin(numeral * 30 * RAD)).toFixed(2)}
          y={(-37 * Math.cos(numeral * 30 * RAD)).toFixed(2)}
        >
          {numeral}
        </text>
      ))}
      <line className={styles.hourHand} x1={0} y1={0} x2={0} y2={-22} transform={`rotate(${hourAngle})`} />
      <line className={styles.minuteHand} x1={0} y1={0} x2={0} y2={-35} transform={`rotate(${minuteAngle})`} />
      <circle className={styles.hub} r={3} />
      <line className={styles.secondHand} x1={0} y1={9} x2={0} y2={-41} transform={`rotate(${secondAngle})`} />
      <circle className={styles.secondHub} r={1.4} />
    </svg>
  )
}

interface WorldMapProps {
  readonly cities: ReadonlyArray<WorldClockCity>
  readonly now: Date
  readonly subsolar: GeoPoint
  readonly hourFormat: ClockHourFormat
}

function WorldMap({ cities, now, subsolar, hourFormat }: WorldMapProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0, fontSize: 0 })
  const dots = useMemo(() => buildMapDotPaths(subsolar), [subsolar])
  const terminator = useMemo(() => buildTerminatorPath(subsolar), [subsolar])

  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) {
      return undefined
    }
    const measure = () => {
      const next = {
        width: element.clientWidth,
        height: element.clientHeight,
        fontSize: parseFloat(getComputedStyle(element).fontSize) || 0,
      }
      setFrame((current) =>
        current.width === next.width && current.height === next.height && current.fontSize === next.fontSize
          ? current
          : next,
      )
    }
    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  const markers = cities.map((city) => ({
    city,
    position: projectToMap(city.latitude, city.longitude),
    time: formatCityTime(now, city.timeZone, hourFormat),
  }))
  const labelSides = layoutMapLabels(
    markers.map(({ city, position, time }) => ({
      id: city.id,
      x: position.x * frame.width,
      y: position.y * frame.height,
      width: Math.max(city.name.length, time.length) * LABEL_CHAR_WIDTH_EM * frame.fontSize,
      height: LABEL_HEIGHT_EM * frame.fontSize,
    })),
    frame.width,
    frame.height,
    LABEL_GAP_EM * frame.fontSize,
    MARKER_RADIUS_EM * frame.fontSize,
  )

  return (
    <div className={styles.mapArea} aria-hidden="true">
      <div ref={frameRef} className={styles.mapFrame}>
        <svg
          className={styles.mapSvg}
          viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <path className={styles.nightDots} d={dots.night} />
          <path className={styles.dayDots} d={dots.day} />
          <path className={styles.terminator} d={terminator} />
        </svg>
        {markers.map(({ city, position, time }) => {
          const side = labelSides[city.id] ?? 'right'
          return (
            <div
              key={city.id}
              className={styles.marker}
              style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
            >
              <span className={styles.markerDot} />
              {side !== 'hidden' && (
                <span className={[styles.markerLabel, LABEL_SIDE_CLASSES[side]].join(' ')}>
                  <span className={styles.markerName}>{city.name}</span>
                  <span className={styles.markerTime}>{time}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TimezoneClockWidget({ isFullscreen = false }: TimezoneClockWidgetProps) {
  const { settings, updateSettings } = useSettings()
  const [now, setNow] = useState(() => new Date())
  const [isEditing, setIsEditing] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => scheduleEverySecond(() => setNow(new Date())), [])

  const cityIds = settings.worldClockCities
  const cities = useMemo(
    () => cityIds.map(getWorldClockCity).filter((city): city is WorldClockCity => city !== undefined),
    [cityIds],
  )

  // The sun barely moves in a minute, so the map and sun times only follow the minute.
  const minuteStart = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS
  const subsolar = useMemo(() => getSubsolarPoint(new Date(minuteStart)), [minuteStart])
  const sunTimes = useMemo(
    () =>
      new Map(
        cities.map((city) => [
          city.id,
          getSunTimes(new Date(minuteStart), city.latitude, city.longitude, city.timeZone),
        ]),
      ),
    [cities, minuteStart],
  )

  const localOffset = getTimeZoneOffsetMinutes(now)

  const toggleCity = (id: string) => {
    updateSettings({
      worldClockCities: cityIds.includes(id) ? cityIds.filter((cityId) => cityId !== id) : [...cityIds, id],
    })
  }

  const removeCity = (id: string) => {
    const next = cityIds.filter((cityId) => cityId !== id)
    updateSettings({ worldClockCities: next })
    if (next.length === 0) {
      setIsEditing(false)
    }
  }

  const formatSunTime = (date: Date | null, timeZone: string) =>
    date ? formatCityTime(date, timeZone, settings.clockHourFormat) : '—'

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.toolbar}>
        {cities.length > 0 && (
          <button
            type="button"
            className={[styles.toolbarButton, styles.editButton].join(' ')}
            aria-pressed={isEditing}
            onClick={() => setIsEditing((current) => !current)}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}
        <button
          type="button"
          className={[styles.toolbarButton, styles.iconButton].join(' ')}
          aria-label="Add city"
          title="Add city"
          onClick={() => setIsPickerOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      <WorldMap cities={cities} now={now} subsolar={subsolar} hourFormat={settings.clockHourFormat} />

      {cities.length === 0 ? (
        <div className={styles.empty}>
          <button type="button" className={styles.emptyButton} onClick={() => setIsPickerOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add a city
          </button>
        </div>
      ) : (
        <ul className={styles.cards} aria-label="World clocks">
          {cities.map((city) => {
            const sun = sunTimes.get(city.id)
            const time = formatCityTime(now, city.timeZone, settings.clockHourFormat)
            const offset = getTimeZoneOffsetMinutes(now, city.timeZone) - localOffset
            return (
              <li key={city.id} className={styles.card} aria-label={`${city.name}, ${time}`}>
                {isEditing && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={`Remove ${city.name}`}
                    onClick={() => removeCity(city.id)}
                  >
                    <MinusCircle size={20} aria-hidden="true" />
                  </button>
                )}
                <AnalogClock
                  time={getZonedTime(now, city.timeZone)}
                  isDay={isDaylight(city.latitude, city.longitude, subsolar)}
                />
                <div className={styles.cardTitle}>
                  {city.name}, {time}
                </div>
                <div className={styles.cardMeta}>
                  {formatRelativeDay(getRelativeDay(now, city.timeZone))}, {formatHourOffset(offset)}
                </div>
                <div className={styles.cardMeta}>Sunrise: {formatSunTime(sun?.sunrise ?? null, city.timeZone)}</div>
                <div className={styles.cardMeta}>Sunset: {formatSunTime(sun?.sunset ?? null, city.timeZone)}</div>
              </li>
            )
          })}
        </ul>
      )}

      {isPickerOpen && (
        <WorldClockCityPicker
          selectedIds={cityIds}
          now={now}
          hourFormat={settings.clockHourFormat}
          onToggle={toggleCity}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  )
}
