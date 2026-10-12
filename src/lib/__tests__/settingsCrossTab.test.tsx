import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../settings'
import { SettingsProvider, useSettings } from '../useSettings'

const SETTINGS_KEY = 'dayboard:settings'

function storageEvent(key: string, newValue: string | null) {
  return new StorageEvent('storage', { key, newValue })
}

describe('settings cross-tab sync', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('applies settings saved in another tab without overwriting them', () => {
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

    // Another tab changes the theme.
    const otherTab = JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'ocean' })
    localStorage.setItem(SETTINGS_KEY, otherTab)
    act(() => {
      window.dispatchEvent(storageEvent(SETTINGS_KEY, otherTab))
    })
    expect(screen.getByText(`ocean:${DEFAULT_SETTINGS.weatherUnitSystem}`)).toBeInTheDocument()

    // A change in this tab keeps the other tab's theme.
    act(() => api!.updateSettings({ weatherUnitSystem: 'imperial' }))
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    expect(stored.theme).toBe('ocean')
    expect(stored.weatherUnitSystem).toBe('imperial')
  })

  it('announces preset changes made in another tab', () => {
    render(
      <SettingsProvider>
        <span />
      </SettingsProvider>,
    )
    const listener = vi.fn()
    window.addEventListener('settingsPresetsChanged', listener)

    act(() => {
      window.dispatchEvent(storageEvent('dayboard:settings-presets', '{}'))
    })

    expect(listener).toHaveBeenCalled()
    window.removeEventListener('settingsPresetsChanged', listener)
  })
})
