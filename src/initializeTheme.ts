import { loadSettings, applyTheme } from './lib/settings'

/**
 * Initialize theme from localStorage before React renders.
 * This prevents a flash of unstyled content (FOUC) on page load.
 */
export function initializeTheme(): void {
  try {
    const settings = loadSettings()
    applyTheme(settings)
  } catch (error) {
    console.error('Failed to initialize theme:', error)
  }
}
