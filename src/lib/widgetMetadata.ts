import type { Widget } from './useWidgetVisibility'

export const WIDGET_METADATA: Array<{ id: Widget; label: string }> = [
  { id: 'clock', label: 'Clock' },
  { id: 'timezoneClock', label: 'Timezone Clock' },
  { id: 'weather', label: 'Weather' },
  { id: 'flights', label: 'Flights Radar' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timer', label: 'Timer' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'kanban', label: 'Mini Kanban' },
  { id: 'notes', label: 'Sticky Notes' },
  { id: 'spotify', label: 'Spotify Player' },
  { id: 'appleMusic', label: 'Apple Music Player' },
  { id: 'applePodcast', label: 'Apple Podcast' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'sports', label: 'Sports Scores' },
  { id: 'quote', label: 'Quote of the Day' },
  { id: 'deviceInfo', label: 'Device Info' },
]

export function getWidgetLabel(widget: Widget): string {
  return WIDGET_METADATA.find((entry) => entry.id === widget)?.label ?? widget
}
