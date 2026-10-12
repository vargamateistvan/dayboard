/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  applyTheme,
  getActiveScheduledPreset,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings'
import { saveWidgetLayoutState } from './useWidgetVisibility'

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const lastScheduledPresetRef = useRef<string | null>(null)
  const scheduledPresetManualOverrideRef = useRef<string | null>(null)

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

  const commitSettings = useCallback((next: Settings) => {
    settingsRef.current = next
    setSettings(next)
    saveSettings(next)
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch }
    const activePreset = getActiveScheduledPreset()

    if (!activePreset) {
      scheduledPresetManualOverrideRef.current = null
    } else {
      const activeSnapshot = JSON.stringify(activePreset.settings)
      const nextSnapshot = JSON.stringify(next)

      if (nextSnapshot === activeSnapshot) {
        scheduledPresetManualOverrideRef.current = null
        lastScheduledPresetRef.current = activePreset.name
      } else {
        scheduledPresetManualOverrideRef.current = activePreset.name
      }
    }

    commitSettings(next)
  }, [commitSettings])

  const syncScheduledPreset = useCallback(() => {
    const activePreset = getActiveScheduledPreset()

    if (!activePreset) {
      lastScheduledPresetRef.current = null
      scheduledPresetManualOverrideRef.current = null
      return
    }

    if (
      scheduledPresetManualOverrideRef.current &&
      scheduledPresetManualOverrideRef.current !== activePreset.name
    ) {
      scheduledPresetManualOverrideRef.current = null
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
  }, [commitSettings])

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
