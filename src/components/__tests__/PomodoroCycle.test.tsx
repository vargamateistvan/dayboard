import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TimerPanel } from '../TimerPanel'
import { SettingsProvider, useSettings } from '../../lib/useSettings'
import { DEFAULT_SETTINGS } from '../../lib/settings'

const STATS_KEY = 'dayboard_pomodoro_stats'

function renderPomodoro(children?: React.ReactNode) {
  localStorage.setItem('dayboard:timer-tab', 'pomodoro')
  localStorage.setItem(
    'dayboard:settings',
    JSON.stringify({ ...DEFAULT_SETTINGS, pomodoroWorkMinutes: 1, pomodoroBreakMinutes: 1 }),
  )
  return render(
    <SettingsProvider>
      <TimerPanel />
      {children}
    </SettingsProvider>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function storedSessionCount(): number {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') as Record<string, { sessionCount: number }>
  return Object.values(stats).reduce((sum, day) => sum + day.sessionCount, 0)
}

describe('Pomodoro cycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T09:00:00'))
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('does not start the next phase when Reset is clicked right after a phase ends', () => {
    renderPomodoro()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    advance(60_100)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    advance(2_000)

    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.queryByText('Break')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.queryByText(/completed/)).not.toBeInTheDocument()
  })

  it('waits for the user when auto-cycle is turned off right after a phase ends', () => {
    renderPomodoro()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    advance(60_100)
    fireEvent.click(screen.getByRole('checkbox', { name: /auto-cycle/i }))
    advance(2_000)

    expect(screen.getByRole('button', { name: 'Start Break' })).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('counts only work sessions, not breaks', () => {
    renderPomodoro()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    advance(60_100) // work ends
    advance(1_000) // auto-cycle starts the break
    advance(60_100) // break ends

    expect(storedSessionCount()).toBe(1)
  })

  it('keeps a running Pomodoro when switching to another timer tab and back', () => {
    renderPomodoro()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    advance(20_000)

    fireEvent.click(screen.getByRole('tab', { name: /Stopwatch/i }))
    advance(5_000)
    fireEvent.click(screen.getByRole('tab', { name: /Pomodoro/i }))

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByText('00:35')).toBeInTheDocument()
  })

  it('shows current settings in the inline editor', () => {
    let api: ReturnType<typeof useSettings> | null = null
    function Probe() {
      api = useSettings()
      return null
    }
    renderPomodoro(<Probe />)

    act(() => api!.updateSettings({ pomodoroWorkMinutes: 45 }))
    fireEvent.click(screen.getByRole('button', { name: /edit settings/i }))

    expect(screen.getByRole('spinbutton', { name: 'Work' })).toHaveValue(45)
  })
})
