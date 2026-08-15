import { applyTheme, getActiveScheduledPreset, loadSettings, saveSettings } from './lib/settings'
import { saveWidgetLayoutState } from './lib/useWidgetVisibility'

/**
 * Initialize theme from localStorage before React renders.
 * This prevents a flash of unstyled content (FOUC) on page load.
 */
export function initializeTheme(): void {
  try {
    const activeScheduledPreset = getActiveScheduledPreset()
    const settings = activeScheduledPreset?.settings ?? loadSettings()

    if (activeScheduledPreset) {
      saveSettings(settings)
      if (activeScheduledPreset.layout) {
        saveWidgetLayoutState(activeScheduledPreset.layout)
      }
    }

    applyTheme(settings)
  } catch (error) {
    console.error('Failed to initialize theme:', error)
  }
}
