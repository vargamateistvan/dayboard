import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ClockWidget } from '../ClockWidget'
import { TimezoneClockWidget } from '../TimezoneClockWidget'
import { QuoteWidget } from '../QuoteWidget'
import { PomodoroStats } from '../PomodoroStats'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'
import { toLocalDayKey } from '../../lib/usePomodoroStats'

// Clock digits render in separate spans, so match on the element's full text.
// The time box wraps a measured text span; return the outermost match (the box).
function getByTimeText(time: string): HTMLElement {
  return screen.getAllByText((_, element) => element?.textContent === time && element.childElementCount > 0)[0]
}

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
      getByTimeText(
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

    expect(getByTimeText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('22rem')

    rerender(
      <SettingsProvider>
        <ClockWidget rowCount={3} />
      </SettingsProvider>,
    )
    expect(getByTimeText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('16rem')

    rerender(
      <SettingsProvider>
        <ClockWidget rowCount={4} />
      </SettingsProvider>,
    )
    expect(getByTimeText(currentTime).parentElement?.style.getPropertyValue('--clock-time-size-auto')).toBe('11rem')
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
    const timeElement = getByTimeText(currentTime)
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
    const timeElement = getByTimeText(currentTime)
    const widgetElement = timeElement.parentElement

    expect(widgetElement?.style.getPropertyValue('--clock-time-stretch')).toBe('1.4')
    expect(widgetElement?.style.getPropertyValue('--clock-time-width-factor')).toBe('1.4')
  })

  it('hides seconds when configured', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockShowSeconds: false,
    })

    renderClockWidget()

    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(getByTimeText(currentTime)).toBeTruthy()
  })

  it('shows milliseconds when configured alongside seconds', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockShowMilliseconds: true,
    })

    renderClockWidget()

    const currentTime = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
      .format(new Date())
      .replace(/\u202f/g, ' ')
    expect(getByTimeText(currentTime)).toBeTruthy()
  })

  it('ignores milliseconds when seconds are hidden', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockShowSeconds: false,
      clockShowMilliseconds: true,
    })

    renderClockWidget()

    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(getByTimeText(currentTime)).toBeTruthy()
  })

  it('uses a 24-hour clock when configured', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockShowSeconds: false,
      clockHourFormat: '24h',
    })

    renderClockWidget()

    const now = new Date()
    const currentTime = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    expect(getByTimeText(currentTime).textContent).toContain(String(now.getHours()).padStart(2, '0'))
    expect(getByTimeText(currentTime).textContent).not.toMatch(/AM|PM/i)
  })

  it('uses a 12-hour clock when configured', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockShowSeconds: false,
      clockHourFormat: '12h',
    })

    renderClockWidget()

    const currentTime = new Date()
      .toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h12',
      })
      .replace(/\u202f/g, ' ')
    expect(getByTimeText(currentTime)).toBeTruthy()
  })

  it('renders each digit on its own flip card when the flip style is selected', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockStyle: 'flip',
    })

    renderClockWidget()

    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const flipTime = screen.getByRole('img', { name: currentTime })
    const digitCount = currentTime.replace(/\D/g, '').length

    expect(Array.from(flipTime.children).filter((child) => /\d/.test(child.textContent ?? ''))).toHaveLength(digitCount)
  })
})

describe('TimezoneClockWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:34:56Z'))
    localStorage.clear()
    saveSettings({
      ...DEFAULT_SETTINGS,
      clockHourFormat: '24h',
      worldClockCities: ['tokyo', 'new-delhi'],
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function renderWorldClock() {
    return render(
      <SettingsProvider>
        <TimezoneClockWidget />
      </SettingsProvider>,
    )
  }

  function savedCities(): unknown {
    return JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}').worldClockCities
  }

  it('shows a clock card for each city with its time, day offset and sun times', () => {
    renderWorldClock()

    const tokyo = screen.getByRole('listitem', { name: 'Tokyo, 21:34' })
    expect(tokyo).toHaveTextContent(/(Today|Tomorrow|Yesterday), [+-]\d+(:\d\d)? HRS?/)
    expect(tokyo).toHaveTextContent(/Sunrise: 0[45]:\d\d/)
    expect(tokyo).toHaveTextContent(/Sunset: 18:\d\d/)
    expect(screen.getByRole('listitem', { name: 'New Delhi, 18:04' })).toBeInTheDocument()
  })

  it('advances the time every second', () => {
    renderWorldClock()

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByRole('listitem', { name: 'Tokyo, 21:35' })).toBeInTheDocument()
  })

  it('removes a city in edit mode', () => {
    renderWorldClock()

    expect(screen.queryByRole('button', { name: 'Remove Tokyo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tokyo' }))

    expect(screen.queryByRole('listitem', { name: /Tokyo/ })).not.toBeInTheDocument()
    expect(savedCities()).toEqual(['new-delhi'])
  })

  it('adds and removes cities from the picker', () => {
    renderWorldClock()

    fireEvent.click(screen.getByRole('button', { name: 'Add city' }))
    const picker = screen.getByRole('dialog', { name: 'Choose a City' })
    fireEvent.change(within(picker).getByRole('searchbox', { name: 'Search cities' }), { target: { value: 'buda' } })
    fireEvent.click(within(picker).getByRole('button', { name: /Budapest/ }))

    expect(savedCities()).toEqual(['tokyo', 'new-delhi', 'budapest'])
    expect(within(picker).getByRole('button', { name: /Budapest/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(within(picker).getByRole('searchbox', { name: 'Search cities' }), { target: { value: 'tokyo' } })
    fireEvent.click(within(picker).getByRole('button', { name: /Tokyo/ }))
    expect(savedCities()).toEqual(['new-delhi', 'budapest'])

    fireEvent.keyDown(picker, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Choose a City' })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /^Budapest, / })).toBeInTheDocument()
  })

  it('adds the top search result with Enter and returns focus when closed', () => {
    renderWorldClock()

    const addButton = screen.getByRole('button', { name: 'Add city' })
    addButton.focus()
    fireEvent.click(addButton)
    const picker = screen.getByRole('dialog', { name: 'Choose a City' })
    const search = within(picker).getByRole('searchbox', { name: 'Search cities' })
    expect(search).toHaveFocus()
    expect(picker).toHaveTextContent('2 cities on your clock')

    fireEvent.change(search, { target: { value: 'paris' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(savedCities()).toEqual(['tokyo', 'new-delhi', 'paris'])
    expect(search).toHaveValue('')
    expect(picker).toHaveTextContent('3 cities on your clock')

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(picker).toHaveTextContent('No cities match “zzz”.')

    fireEvent.click(within(picker).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog', { name: 'Choose a City' })).not.toBeInTheDocument()
    expect(addButton).toHaveFocus()
  })

  it('offers to add a city when the list is empty', () => {
    saveSettings({ ...DEFAULT_SETTINGS, worldClockCities: [] })
    renderWorldClock()

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add a city' }))
    expect(screen.getByRole('dialog', { name: 'Choose a City' })).toBeInTheDocument()
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
    const todayKey = toLocalDayKey(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toLocalDayKey(yesterday)

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
