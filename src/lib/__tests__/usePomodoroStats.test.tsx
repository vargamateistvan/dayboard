import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import { usePomodoroStats } from '../usePomodoroStats'
import { PomodoroStats } from '../../components/PomodoroStats'

const STORAGE_KEY = 'dayboard_pomodoro_stats'

// Vitest runs in Node; the app's tsconfig has no Node types.
declare const process: { env: Record<string, string | undefined> }

describe('usePomodoroStats', () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    // West of UTC, UTC date keys roll over in the evening (19:00/20:00 local).
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    // Assigning undefined would store the string "undefined".
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  beforeEach(() => {
    vi.useFakeTimers()
    // 21:30 on Aug 8 in New York, already Aug 9 in UTC.
    vi.setSystemTime(new Date('2026-08-09T01:30:00Z'))
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('files sessions under the local date', () => {
    const { result } = renderHook(() => usePomodoroStats())
    act(() => result.current.recordSession(25))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(Object.keys(stored)).toEqual(['2026-08-08'])
    expect(result.current.stats).toMatchObject({ sessionCount: 1, totalMinutes: 25 })
  })

  it('builds the weekly chart from local dates', () => {
    const { result } = renderHook(() => usePomodoroStats())
    act(() => result.current.recordSession(25))

    const week = result.current.getWeeklyStats()
    expect(week.map((day) => day.date)).toEqual([
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
    ])
    expect(week[week.length - 1].minutes).toBe(25)
  })

  it('labels each bar with its local weekday', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ '2026-08-08': { sessionCount: 1, totalMinutes: 25 } }))
    render(<PomodoroStats />)

    // Aug 8, 2026 is a Saturday.
    expect(screen.getByTitle('2026-08-08: 25min')).toHaveTextContent('Sa')
  })

  it('updates an open stats panel when a session is recorded elsewhere', () => {
    render(<PomodoroStats />)
    const { result } = renderHook(() => usePomodoroStats())

    act(() => result.current.recordSession(25))

    expect(screen.getAllByText('25').length).toBeGreaterThan(0)
    expect(screen.getByText('1', { exact: true })).toBeInTheDocument()
  })
})
