/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  applyTheme,
  getActiveScheduledPreset,
  isPresetStorageKey,
  loadSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from './settings'
import { readStorage, removeStorage, writeStorage } from './storage'
import { saveWidgetLayoutState } from './useWidgetVisibility'

// Persisted so a manual preset choice survives a reload instead of the
// scheduled preset being re-applied over it.
const SCHEDULED_PRESET_OVERRIDE_STORAGE_KEY = 'dayboard:scheduled-preset-override'

function persistScheduledPresetOverride(name: string | null) {
  if (name) {
    writeStorage(SCHEDULED_PRESET_OVERRIDE_STORAGE_KEY, name)
  } else {
    removeStorage(SCHEDULED_PRESET_OVERRIDE_STORAGE_KEY)
  }
}

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const lastScheduledPresetRef = useRef<string | null>(null)
  const scheduledPresetManualOverrideRef = useRef<string | null>(
    readStorage(SCHEDULED_PRESET_OVERRIDE_STORAGE_KEY),
  )

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

  // Latest settings, including updates not yet rendered, so consecutive
  // updateSettings calls in one tick build on each other. Storage writes stay
  // out of state updaters, which React may call twice.
  const settingsRef = useRef(settings)

  const setScheduledPresetManualOverride = useCallback((name: string | null) => {
    scheduledPresetManualOverrideRef.current = name
    persistScheduledPresetOverride(name)
  }, [])

  const commitSettings = useCallback((next: Settings) => {
    settingsRef.current = next
    setSettings(next)
    saveSettings(next)
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch }
    const activePreset = getActiveScheduledPreset()

    if (!activePreset) {
      setScheduledPresetManualOverride(null)
    } else {
      const activeSnapshot = JSON.stringify(activePreset.settings)
      const nextSnapshot = JSON.stringify(next)

      if (nextSnapshot === activeSnapshot) {
        setScheduledPresetManualOverride(null)
        lastScheduledPresetRef.current = activePreset.name
      } else {
        setScheduledPresetManualOverride(activePreset.name)
      }
    }

    commitSettings(next)
  }, [commitSettings, setScheduledPresetManualOverride])

  const syncScheduledPreset = useCallback(() => {
    const activePreset = getActiveScheduledPreset()

    if (!activePreset) {
      lastScheduledPresetRef.current = null
      setScheduledPresetManualOverride(null)
      return
    }

    if (
      scheduledPresetManualOverrideRef.current &&
      scheduledPresetManualOverrideRef.current !== activePreset.name
    ) {
      setScheduledPresetManualOverride(null)
    }

    if (scheduledPresetManualOverrideRef.current === activePreset.name) {
      return
    }

    const prevSnapshot = JSON.stringify(settingsRef.current)
    const nextSnapshot = JSON.stringify(activePreset.settings)

    if (
      lastScheduledPresetRef.current === activePreset.name &&
      prevSnapshot === nextSnapshot
    ) {
      return
    }

    lastScheduledPresetRef.current = activePreset.name
    commitSettings(activePreset.settings)
    if (activePreset.layout) {
      saveWidgetLayoutState(activePreset.layout)
    }
  }, [commitSettings, setScheduledPresetManualOverride])

  // Follow settings and presets saved in other tabs. Only reload here; saving
  // again would bounce the change back and forth between tabs.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SETTINGS_STORAGE_KEY) {
        const next = loadSettings()
        settingsRef.current = next
        setSettings(next)
      } else if (isPresetStorageKey(event.key)) {
        window.dispatchEvent(new CustomEvent('settingsPresetsChanged'))
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
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
