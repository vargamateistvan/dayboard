import { useState } from 'react'
import { readJson, writeJson } from './storage'

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

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
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

function readAllStats(): StoredStats {
  return readJson(STORAGE_KEY, normalizeStoredStats, {})
}

export function usePomodoroStats() {
  const [stats, setStats] = useState<PomodoroStats>(() => {
    const todayKey = getTodayKey()
    const today = readAllStats()[todayKey]
    if (!today) {
      return { sessionCount: 0, totalMinutes: 0, lastSessionDate: '' }
    }
    return {
      sessionCount: today.sessionCount,
      totalMinutes: today.totalMinutes,
      lastSessionDate: todayKey,
    }
  })

  const recordSession = (minutes: number) => {
    const todayKey = getTodayKey()
    const allStats = readAllStats()

    if (!allStats[todayKey]) {
      allStats[todayKey] = { sessionCount: 0, totalMinutes: 0 }
    }

    allStats[todayKey].sessionCount++
    allStats[todayKey].totalMinutes += minutes

    writeJson(STORAGE_KEY, allStats)

    setStats({
      sessionCount: allStats[todayKey].sessionCount,
      totalMinutes: allStats[todayKey].totalMinutes,
      lastSessionDate: todayKey,
    })
  }

  const getWeeklyStats = (): { date: string; minutes: number }[] => {
    const allStats = readAllStats()
    if (Object.keys(allStats).length === 0) return []

    const past7Days: { date: string; minutes: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split('T')[0]
      past7Days.push({
        date: key,
        minutes: allStats[key]?.totalMinutes || 0,
      })
    }

    return past7Days
  }

  return { stats, recordSession, getWeeklyStats }
}
