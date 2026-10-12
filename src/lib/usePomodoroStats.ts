import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { readStorage, writeJson } from './storage'

export interface PomodoroStats {
  sessionCount: number
  totalMinutes: number
  lastSessionDate: string
}

interface StoredStats {
  [date: string]: {
    sessionCount: number
    totalMinutes: number
  }
}

const STORAGE_KEY = 'dayboard_pomodoro_stats'
const CHANGE_EVENT = 'dayboard:pomodoro-stats-change'

/** Local calendar date as YYYY-MM-DD, so "today" follows the user's midnight. */
export function toLocalDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Parses a YYYY-MM-DD key as a local date (not UTC midnight). */
export function fromLocalDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function normalizeStoredStats(value: unknown): StoredStats | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const result: StoredStats = {}
  for (const [date, day] of Object.entries(value as Record<string, unknown>)) {
    if (!day || typeof day !== 'object') continue
    const entry = day as Record<string, unknown>
    result[date] = {
      sessionCount: toCount(entry.sessionCount),
      totalMinutes: toCount(entry.totalMinutes),
    }
  }
  return result
}

function parseStats(raw: string | null): StoredStats {
  if (raw === null) return {}
  try {
    return normalizeStoredStats(JSON.parse(raw)) ?? {}
  } catch {
    return {}
  }
}

// One store shared by every hook instance (the timer and the stats panel),
// and by other tabs through `storage` events.
function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', handleStorage)
  }
}

function getSnapshot(): string | null {
  return readStorage(STORAGE_KEY)
}

export function usePomodoroStats() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const allStats = useMemo(() => parseStats(raw), [raw])

  const todayKey = toLocalDayKey(new Date())
  const today = allStats[todayKey]
  const stats: PomodoroStats = today
    ? { sessionCount: today.sessionCount, totalMinutes: today.totalMinutes, lastSessionDate: todayKey }
    : { sessionCount: 0, totalMinutes: 0, lastSessionDate: '' }

  const recordSession = useCallback((minutes: number) => {
    const key = toLocalDayKey(new Date())
    const nextStats = parseStats(readStorage(STORAGE_KEY))
    const day = nextStats[key] ?? { sessionCount: 0, totalMinutes: 0 }
    nextStats[key] = { sessionCount: day.sessionCount + 1, totalMinutes: day.totalMinutes + minutes }

    writeJson(STORAGE_KEY, nextStats)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const getWeeklyStats = useCallback((): { date: string; minutes: number }[] => {
    if (Object.keys(allStats).length === 0) return []

    const past7Days: { date: string; minutes: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = toLocalDayKey(date)
      past7Days.push({ date: key, minutes: allStats[key]?.totalMinutes || 0 })
    }
    return past7Days
  }, [allStats])

  return { stats, recordSession, getWeeklyStats }
}
