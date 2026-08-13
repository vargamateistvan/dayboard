import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClockWidget } from '../ClockWidget'
import { TimezoneClockWidget } from '../TimezoneClockWidget'
import { QuoteWidget } from '../QuoteWidget'
import { PomodoroStats } from '../PomodoroStats'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'

function renderClockWidget(rowCount?: number) {
  return render(
    <SettingsProvider>
      <ClockWidget rowCount={rowCount} />
    </SettingsProvider>,
  )
}

describe('ClockWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:34:56Z'))
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the current time and date', () => {
    const now = new Date()

    renderClockWidget()

    expect(
      screen.getByText(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      ),
    ).toBeInTheDocument()
  })

  it('uses row-count-specific font sizing for the main clock', () => {
    const { rerender } = renderClockWidget(2)
    const currentTime = new Date().toLocaleTimeString(undefined, {
     hour: '2-digit',
     minute: '2-digit',
     second: '2-digit',
    })

    expect(screen.getByText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('22rem')

    rerender(
      <SettingsProvider>
        <ClockWidget rowCount={3} />
      </SettingsProvider>,
    )
    expect(screen.getByText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('16rem')

    rerender(
      <SettingsProvider>
        <ClockWidget rowCount={4} />
      </SettingsProvider>,
    )
    expect(screen.getByText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('11rem')
  })

  it('applies manual clock font-size settings when configured', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockTimeFontSizeRem: 19.5,
      clockDateFontSizeRem: 2.2,
    })

    renderClockWidget()

    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const timeElement = screen.getByText(currentTime)
    const widgetElement = timeElement.parentElement

    expect(widgetElement?.style.getPropertyValue('--clock-time-size-override')).toBe('19.5rem')
    expect(widgetElement?.style.getPropertyValue('--clock-date-size-override')).toBe('2.2rem')
  })

  it('applies manual clock stretch when configured', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockTimeStretchPercent: 140,
    })

    renderClockWidget()

    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const timeElement = screen.getByText(currentTime)
    const widgetElement = timeElement.parentElement

    expect(widgetElement?.style.getPropertyValue('--clock-time-stretch')).toBe('1.4')
    expect(widgetElement?.style.getPropertyValue('--clock-time-width-factor')).toBe('1.4')
  })
})

describe('TimezoneClockWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:34:56Z'))
    localStorage.clear()
    saveSettings({
      ...DEFAULT_SETTINGS,
      worldClockCity: 'Tokyo',
      worldClockTimeZone: 'Asia/Tokyo',
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders local and selected city clocks', () => {
    render(
      <SettingsProvider>
        <TimezoneClockWidget />
      </SettingsProvider>,
    )

    expect(screen.getByText(/My location/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo \(Asia\/Tokyo\)/)).toBeInTheDocument()
  })
})

describe('QuoteWidget', () => {
  it('renders quote title and supports changing quote', () => {
    render(<QuoteWidget />)

    expect(screen.getByText('Quote of the Day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show another quote' })).toBeInTheDocument()
  })
})

describe('PomodoroStats', () => {
  const STORAGE_KEY = 'dayboard_pomodoro_stats'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows today and weekly totals from stored sessions', () => {
    const todayKey = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = yesterday.toISOString().split('T')[0]

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [todayKey]: { sessionCount: 2, totalMinutes: 31 },
        [yesterdayKey]: { sessionCount: 1, totalMinutes: 32 },
      }),
    )

    render(<PomodoroStats />)

    expect(screen.getByText('31', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('2', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('63', { exact: true })).toBeInTheDocument()
    expect(screen.getByTitle(`${todayKey}: 31min`)).toBeInTheDocument()
    expect(screen.getAllByTitle(/\d{4}-\d{2}-\d{2}: \d+min/)).toHaveLength(7)
  })
})
