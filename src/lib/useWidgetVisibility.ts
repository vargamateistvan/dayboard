import { useCallback, useSyncExternalStore } from 'react'

export type Widget = 'clock' | 'weather' | 'calendar' | 'timer' | 'tasks'

type WidgetVisibility = Record<Widget, boolean>

const STORAGE_KEY = 'dayboard_widget_visibility'
const CHANGE_EVENT = 'dayboard:widget-visibility-change'

const DEFAULT_VISIBILITY: WidgetVisibility = {
  clock: true,
  weather: true,
  calendar: true,
  timer: true,
  tasks: true,
}

let cachedRaw: string | null = null
let cachedVisibility: WidgetVisibility = DEFAULT_VISIBILITY

function mergeVisibility(value: unknown): WidgetVisibility {
  if (!value || typeof value !== 'object') {
    return DEFAULT_VISIBILITY
  }

  return {
    ...DEFAULT_VISIBILITY,
    ...(value as Partial<WidgetVisibility>),
  }
}

function readVisibility(): WidgetVisibility {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) {
    return cachedVisibility
  }

  if (!raw) {
    cachedRaw = null
    cachedVisibility = DEFAULT_VISIBILITY
    return cachedVisibility
  }

  try {
    const parsed = mergeVisibility(JSON.parse(raw))
    cachedRaw = raw
    cachedVisibility = parsed
    return cachedVisibility
  } catch {
    cachedRaw = raw
    cachedVisibility = DEFAULT_VISIBILITY
    return cachedVisibility
  }
}

function writeVisibility(nextVisibility: WidgetVisibility) {
  const raw = JSON.stringify(nextVisibility)
  cachedRaw = raw
  cachedVisibility = nextVisibility
  localStorage.setItem(STORAGE_KEY, raw)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && event.key === STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

export function useWidgetVisibility() {
  const visibility = useSyncExternalStore(
    subscribe,
    readVisibility,
    () => DEFAULT_VISIBILITY,
  )

  const toggleWidget = useCallback((widget: Widget, visible?: boolean) => {
    const nextVisibility = {
      ...readVisibility(),
      [widget]: visible !== undefined ? visible : !readVisibility()[widget],
    }
    writeVisibility(nextVisibility)
  }, [])

  const setAllVisible = useCallback((visible: boolean) => {
    writeVisibility({
      clock: visible,
      weather: visible,
      calendar: visible,
      timer: visible,
      tasks: visible,
    })
  }, [])

  return { visibility, toggleWidget, setAllVisible }
}
