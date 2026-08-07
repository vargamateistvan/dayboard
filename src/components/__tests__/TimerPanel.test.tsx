import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TimerPanel } from '../TimerPanel'
import { SettingsProvider } from '../../lib/useSettings'

const STORAGE_KEY = 'dayboard:timer-tab'

function renderTimerPanel() {
  return render(
    <SettingsProvider>
      <TimerPanel />
    </SettingsProvider>,
  )
}

describe('TimerPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to stopwatch when nothing is stored', () => {
    renderTimerPanel()

    expect(screen.getByRole('tab', { name: /Stopwatch/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('persists the selected timer tab', () => {
    renderTimerPanel()

    fireEvent.click(screen.getByRole('tab', { name: /Countdown/i }))

    expect(localStorage.getItem(STORAGE_KEY)).toBe('countdown')
  })

  it('restores the stored timer tab on next render', () => {
    localStorage.setItem(STORAGE_KEY, 'countdown')

    renderTimerPanel()

    expect(screen.getByRole('tab', { name: /Countdown/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-mode')

    renderTimerPanel()

    expect(screen.getByRole('tab', { name: /Stopwatch/i })).toHaveAttribute('aria-selected', 'true')
  })
})
