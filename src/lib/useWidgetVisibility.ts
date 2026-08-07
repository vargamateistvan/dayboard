import { useState } from 'react'

export type Widget = 'clock' | 'weather' | 'calendar' | 'timer' | 'tasks'

type WidgetVisibility = Record<Widget, boolean>

const STORAGE_KEY = 'dayboard_widget_visibility'

const DEFAULT_VISIBILITY: WidgetVisibility = {
  clock: true,
  weather: true,
  calendar: true,
  timer: true,
  tasks: true,
}

export function useWidgetVisibility() {
  const [visibility, setVisibility] = useState<WidgetVisibility>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return { ...DEFAULT_VISIBILITY, ...JSON.parse(saved) }
      } catch {
        return DEFAULT_VISIBILITY
      }
    }
    return DEFAULT_VISIBILITY
  })

  const toggleWidget = (widget: Widget, visible?: boolean) => {
    setVisibility(prev => {
      const newVisibility = {
        ...prev,
        [widget]: visible !== undefined ? visible : !prev[widget],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVisibility))
      return newVisibility
    })
  }

  const setAllVisible = (visible: boolean) => {
    const newVisibility: WidgetVisibility = {
      clock: visible,
      weather: visible,
      calendar: visible,
      timer: visible,
      tasks: visible,
    }
    setVisibility(newVisibility)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVisibility))
  }

  return { visibility, toggleWidget, setAllVisible }
}
