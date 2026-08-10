import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  applyTheme,
  DEFAULT_SETTINGS,
  getActiveScheduledPreset,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings'

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const lastScheduledPresetRef = useRef<string | null>(null)

  useEffect(() => {
    applyTheme(settings)
  }, [settings])

  // Re-apply when system prefers-color-scheme changes
  useEffect(() => {
    if (settings.colorScheme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(settings)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const syncScheduledPreset = useCallback(() => {
    const activePreset = getActiveScheduledPreset()

    if (!activePreset) {
      lastScheduledPresetRef.current = null
      return
    }

    setSettings((prev) => {
      const prevSnapshot = JSON.stringify(prev)
      const nextSnapshot = JSON.stringify(activePreset.settings)

      if (
        lastScheduledPresetRef.current === activePreset.name &&
        prevSnapshot === nextSnapshot
      ) {
        return prev
      }

      lastScheduledPresetRef.current = activePreset.name
      saveSettings(activePreset.settings)
      return activePreset.settings
    })
  }, [])

  useEffect(() => {
    syncScheduledPreset()

    const intervalId = window.setInterval(syncScheduledPreset, 60_000)
    const handleVisibilityOrFocus = () => syncScheduledPreset()

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('settingsPresetsChanged', handleVisibilityOrFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('settingsPresetsChanged', handleVisibilityOrFocus)
    }
  }, [syncScheduledPreset])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

export { DEFAULT_SETTINGS }
