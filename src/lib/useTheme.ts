import { useState, useEffect } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'dayboard_theme_mode'

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved as ThemeMode) || 'auto'
  })

  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  // Listen to system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Determine effective theme
  const effectiveTheme = themeMode === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : themeMode

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeMode)
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [themeMode, effectiveTheme])

  // Auto-switch based on time of day
  useEffect(() => {
    if (themeMode !== 'auto') return

    const updateAutoTheme = () => {
      const hour = new Date().getHours()
      // Dark theme from 20:00 (8 PM) to 6:00 AM
      const shouldBeDark = hour >= 20 || hour < 6
      setSystemPrefersDark(shouldBeDark)
    }

    updateAutoTheme()
    const interval = setInterval(updateAutoTheme, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [themeMode])

  return { themeMode, setThemeMode, effectiveTheme, systemPrefersDark }
}
