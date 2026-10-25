import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, CirclePlus, Search, X } from 'lucide-react'
import type { ClockHourFormat } from '../lib/settings'
import { formatCityTime, formatHourOffset, getTimeZoneOffsetMinutes } from '../lib/worldClock'
import { searchWorldClockCities, type WorldClockCity } from '../lib/worldClockCities'
import styles from './WorldClockCityPicker.module.css'

interface WorldClockCityPickerProps {
  readonly selectedIds: ReadonlyArray<string>
  readonly now: Date
  readonly hourFormat: ClockHourFormat
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

interface CityGroup {
  readonly letter: string | null
  readonly cities: ReadonlyArray<WorldClockCity>
}

function groupByInitial(cities: ReadonlyArray<WorldClockCity>): CityGroup[] {
  const groups: Array<{ letter: string; cities: WorldClockCity[] }> = []
  for (const city of cities) {
    // File "São Paulo" under S and "Bogotá" under B, like a phone's contact list.
    const letter = city.name.normalize('NFD').charAt(0).toLocaleUpperCase()
    const current = groups[groups.length - 1]
    if (current?.letter === letter) {
      current.cities.push(city)
    } else {
      groups.push({ letter, cities: [city] })
    }
  }
  return groups
}

export function WorldClockCityPicker({ selectedIds, now, hourFormat, onToggle, onClose }: WorldClockCityPickerProps) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const results = useMemo(() => searchWorldClockCities(query), [query])
  const isSearching = query.trim().length > 0
  const groups = useMemo<CityGroup[]>(
    () => (isSearching ? [{ letter: null, cities: results }] : groupByInitial(results)),
    [isSearching, results],
  )
  const localOffset = getTimeZoneOffsetMinutes(now)
  const selectedCount = selectedIds.length

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  const getOptions = () =>
    Array.from(sheetRef.current?.querySelectorAll<HTMLButtonElement>('[data-city-option]') ?? [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const options = getOptions()
      const index = options.indexOf(event.target as HTMLButtonElement)
      const next =
        event.key === 'ArrowDown'
          ? options[index + 1]
          : index > 0
            ? options[index - 1]
            : inputRef.current
      if (next) {
        event.preventDefault()
        next.focus()
      }
      return
    }

    // Keep Tab inside the dialog while it is open.
    if (event.key === 'Tab' && sheetRef.current) {
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('input, button'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  const addTopResult = () => {
    const top = results[0]
    if (isSearching && top && !selectedIds.includes(top.id)) {
      onToggle(top.id)
      setQuery('')
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              Choose a City
            </h2>
            <p className={styles.subtitle}>
              {selectedCount === 0
                ? 'No cities on your clock yet'
                : `${selectedCount} ${selectedCount === 1 ? 'city' : 'cities'} on your clock`}
            </p>
          </div>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </header>

        <div className={styles.searchRow}>
          <label className={styles.searchField}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={inputRef}
              className={styles.searchInput}
              type="search"
              value={query}
              placeholder="Search city, country or time zone"
              aria-label="Search cities"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTopResult()
                }
              }}
            />
            {isSearching && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
        </div>

        <div className={styles.list}>
          {groups.map((group) => (
            <section key={group.letter ?? 'results'} className={styles.group}>
              {group.letter && (
                <h3 className={styles.groupHeader} aria-hidden="true">
                  {group.letter}
                </h3>
              )}
              <ul className={styles.groupList}>
                {group.cities.map((city) => {
                  const isSelected = selectedIds.includes(city.id)
                  const offset = getTimeZoneOffsetMinutes(now, city.timeZone) - localOffset
                  return (
                    <li key={city.id} className={styles.groupItem}>
                      <button
                        type="button"
                        className={[styles.option, isSelected ? styles.optionSelected : ''].join(' ')}
                        aria-label={`${city.name}, ${city.country}`}
                        aria-pressed={isSelected}
                        data-city-option=""
                        onClick={() => onToggle(city.id)}
                      >
                        <span className={styles.optionText}>
                          <span className={styles.optionName}>{city.name}</span>
                          <span className={styles.optionMeta}>
                            {city.country} · {formatHourOffset(offset)}
                          </span>
                        </span>
                        <span className={styles.optionTime}>{formatCityTime(now, city.timeZone, hourFormat)}</span>
                        {isSelected ? (
                          <CircleCheck size={20} className={styles.optionIconSelected} aria-hidden="true" />
                        ) : (
                          <CirclePlus size={20} className={styles.optionIcon} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {results.length === 0 && (
            <p className={styles.empty}>
              No cities match “{query.trim()}”.
              <span className={styles.emptyHint}>Try a country or a time zone like “Europe”.</span>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
