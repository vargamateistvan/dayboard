import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActiveScheduledPreset, listPresets, saveSettings, DEFAULT_SETTINGS } from '../settings'
import { SettingsProvider, useSettings } from '../useSettings'
import { useFocusMode } from '../useFocusMode'
import { usePomodoroStats } from '../usePomodoroStats'
import { saveWidgetLayoutState, loadWidgetLayoutState } from '../useWidgetVisibility'
import { STORAGE_ERROR_EVENT } from '../storage'

function failWrites() {
  return vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
}

describe('storage resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('corrupt stored JSON', () => {
    it('treats a corrupt preset store as empty', () => {
      localStorage.setItem('dayboard:settings-presets', '{')
      expect(listPresets()).toEqual([])
      expect(getActiveScheduledPreset()).toBeNull()
    })

    it('treats a non-object preset store as empty', () => {
      localStorage.setItem('dayboard:settings-presets', '"oops"')
      expect(listPresets()).toEqual([])
    })

    it('mounts SettingsProvider with a corrupt preset store', () => {
      localStorage.setItem('dayboard:settings-presets', '{')
      function Probe() {
        const { settings } = useSettings()
        return <span>{settings.theme}</span>
      }
      render(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      )
      expect(screen.getByText(DEFAULT_SETTINGS.theme)).toBeInTheDocument()
    })

    it('reads focus mode synchronously and ignores corrupt values', () => {
      localStorage.setItem('dayboard_focus_mode', 'true')
      expect(renderHook(() => useFocusMode()).result.current.focusMode).toBe(true)

      localStorage.setItem('dayboard_focus_mode', '{')
      expect(renderHook(() => useFocusMode()).result.current.focusMode).toBe(false)
    })

    it('records a Pomodoro session over corrupt stats', () => {
      localStorage.setItem('dayboard_pomodoro_stats', '{')
      const { result } = renderHook(() => usePomodoroStats())

      expect(() => result.current.getWeeklyStats()).not.toThrow()
      act(() => result.current.recordSession(25))

      expect(result.current.stats.sessionCount).toBe(1)
      expect(result.current.stats.totalMinutes).toBe(25)
    })
  })

  describe('failed writes', () => {
    it('reports instead of throwing when settings cannot be saved', () => {
      failWrites()
      const listener = vi.fn()
      window.addEventListener(STORAGE_ERROR_EVENT, listener)

      expect(() => saveSettings({ ...DEFAULT_SETTINGS, theme: 'ocean' })).not.toThrow()
      expect(listener).toHaveBeenCalled()

      window.removeEventListener(STORAGE_ERROR_EVENT, listener)
    })

    it('keeps the in-memory settings update when the write fails', () => {
      let api: ReturnType<typeof useSettings> | null = null
      function Probe() {
        api = useSettings()
        return <span>{api.settings.theme}</span>
      }
      render(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      )

      failWrites()
      act(() => api!.updateSettings({ theme: 'ocean' }))
      expect(screen.getByText('ocean')).toBeInTheDocument()
    })

    it('applies consecutive updateSettings calls in the same tick', () => {
      let api: ReturnType<typeof useSettings> | null = null
      function Probe() {
        api = useSettings()
        return <span>{`${api.settings.theme}:${api.settings.weatherUnitSystem}`}</span>
      }
      render(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      )

      act(() => {
        api!.updateSettings({ theme: 'ocean' })
        api!.updateSettings({ weatherUnitSystem: 'imperial' })
      })

      expect(screen.getByText('ocean:imperial')).toBeInTheDocument()
      const stored = JSON.parse(localStorage.getItem('dayboard:settings') ?? '{}')
      expect(stored.theme).toBe('ocean')
      expect(stored.weatherUnitSystem).toBe('imperial')
    })

    it('keeps a layout edit in memory when the layout cannot be saved', () => {
      const layout = loadWidgetLayoutState()
      failWrites()
      expect(() => saveWidgetLayoutState({ ...layout, rowCount: layout.rowCount + 1 })).not.toThrow()
      expect(loadWidgetLayoutState().rowCount).toBe(layout.rowCount + 1)
    })

    it('does not throw when focus mode cannot be saved', () => {
      const { result } = renderHook(() => useFocusMode())
      failWrites()
      act(() => result.current.toggleFocusMode())
      expect(result.current.focusMode).toBe(true)
    })
  })
})
