import type { Widget } from './useWidgetVisibility'

export const WIDGET_METADATA: Array<{ id: Widget; label: string }> = [
  { id: 'clock', label: 'Clock' },
  { id: 'weather', label: 'Weather' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timer', label: 'Timer' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Sticky Notes' },
  { id: 'spotify', label: 'Spotify Player' },
  { id: 'appleMusic', label: 'Apple Music Player' },
  { id: 'spotifyPodcast', label: 'Spotify Podcast' },
  { id: 'applePodcast', label: 'Apple Podcast' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'currencies', label: 'Currencies' },
]

export function getWidgetLabel(widget: Widget): string {
  return WIDGET_METADATA.find((entry) => entry.id === widget)?.label ?? widget
}
