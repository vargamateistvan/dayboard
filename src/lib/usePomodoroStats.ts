import { useState } from 'react'

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

export function usePomodoroStats() {
  const [stats, setStats] = useState<PomodoroStats>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { sessionCount: 0, totalMinutes: 0, lastSessionDate: '' }
    }

    try {
      const allStats = JSON.parse(stored) as StoredStats
      const todayKey = getTodayKey()
      const today = allStats[todayKey] || { sessionCount: 0, totalMinutes: 0 }
      return {
        sessionCount: today.sessionCount,
        totalMinutes: today.totalMinutes,
        lastSessionDate: todayKey,
      }
    } catch {
      return { sessionCount: 0, totalMinutes: 0, lastSessionDate: '' }
    }
  })

  const recordSession = (minutes: number) => {
    const todayKey = getTodayKey()
    const stored = localStorage.getItem(STORAGE_KEY)
    const allStats = stored ? JSON.parse(stored) : {}

    if (!allStats[todayKey]) {
      allStats[todayKey] = { sessionCount: 0, totalMinutes: 0 }
    }

    allStats[todayKey].sessionCount++
    allStats[todayKey].totalMinutes += minutes

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allStats))

    setStats({
      sessionCount: allStats[todayKey].sessionCount,
      totalMinutes: allStats[todayKey].totalMinutes,
      lastSessionDate: todayKey,
    })
  }

  const getWeeklyStats = (): { date: string; minutes: number }[] => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const allStats = JSON.parse(stored) as StoredStats
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
