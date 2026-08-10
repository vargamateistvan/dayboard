import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'dayboard_focus_mode'

export function useFocusMode() {
  const [focusMode, setFocusMode] = useState(false)

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setFocusMode(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage
  const toggleFocusMode = useCallback((enabled?: boolean) => {
    setFocusMode((prev) => {
      const newValue = enabled !== undefined ? enabled : !prev
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newValue))
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('focusModeChange', { detail: { focusMode: newValue } }))
      
      return newValue
    })
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
