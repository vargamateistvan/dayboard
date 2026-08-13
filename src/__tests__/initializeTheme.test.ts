import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTheme } from '../initializeTheme'
import * as settings from '../lib/settings'

vi.mock('../lib/settings', async () => {
  const actual = await vi.importActual<typeof import('../lib/settings')>('../lib/settings')
  return {
    ...actual,
    applyTheme: vi.fn(),
    getActiveScheduledPreset: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
  }
})

describe('initializeTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies persisted settings when no scheduled preset is active', () => {
    const persistedSettings = { ...settings.DEFAULT_SETTINGS, theme: 'nature' as const }

    vi.mocked(settings.getActiveScheduledPreset).mockReturnValue(null)
    vi.mocked(settings.loadSettings).mockReturnValue(persistedSettings)

    initializeTheme()

    expect(settings.loadSettings).toHaveBeenCalledTimes(1)
    expect(settings.saveSettings).not.toHaveBeenCalled()
    expect(settings.applyTheme).toHaveBeenCalledWith(persistedSettings)
  })

  it('applies and persists the active scheduled preset before app render', () => {
    const scheduledSettings = { ...settings.DEFAULT_SETTINGS, theme: 'ocean' as const }

    vi.mocked(settings.getActiveScheduledPreset).mockReturnValue({
      name: 'focus-hours',
      settings: scheduledSettings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    initializeTheme()

    expect(settings.loadSettings).not.toHaveBeenCalled()
    expect(settings.saveSettings).toHaveBeenCalledWith(scheduledSettings)
    expect(settings.applyTheme).toHaveBeenCalledWith(scheduledSettings)
  })
})
