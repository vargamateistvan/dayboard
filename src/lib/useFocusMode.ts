import { useState, useEffect, useCallback, useRef } from 'react'
import { readJson, writeJson } from './storage'

const STORAGE_KEY = 'dayboard_focus_mode'

const asBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null)

export function useFocusMode() {
  // Read synchronously so widgets hidden by focus mode never mount on load.
  const [focusMode, setFocusMode] = useState(() => readJson(STORAGE_KEY, asBoolean, false))
  const focusModeRef = useRef(focusMode)

  const toggleFocusMode = useCallback((enabled?: boolean) => {
    const newValue = enabled !== undefined ? enabled : !focusModeRef.current
    focusModeRef.current = newValue
    setFocusMode(newValue)
    writeJson(STORAGE_KEY, newValue)

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('focusModeChange', { detail: { focusMode: newValue } }))
  }, [])

  // Listen for Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode])

  return { focusMode, toggleFocusMode }
}
