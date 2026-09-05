import { useCallback, useState } from 'react'
import { showNotification } from './notifications'
import type { Settings } from './settings'

export type NotificationType = 'event' | 'weather' | 'timer'
export interface EventNotification {
  id: string
  type: NotificationType
  title: string
  body?: string
  timestamp: number
}

const MAX_HISTORY_ENTRIES = 50

export function useEventNotifications(settings: Pick<
  Settings,
  'notificationsEnabled' | 'desktopNotificationsEnabled' | 'calendarNotificationsEnabled' | 'timerNotificationsEnabled'
>) {
  const [notifications, setNotifications] = useState<EventNotification[]>([])
  const [history, setHistory] = useState<EventNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const addNotification = useCallback((notification: Omit<EventNotification, 'id' | 'timestamp'>) => {
    if (
      !settings.notificationsEnabled
      || (notification.type === 'event' && !settings.calendarNotificationsEnabled)
      || (notification.type === 'timer' && !settings.timerNotificationsEnabled)
    ) {
      return
    }

    const id = `${notification.type}-${Date.now()}`
    const newNotification: EventNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
    }

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)])
    setHistory(prev => [newNotification, ...prev].slice(0, MAX_HISTORY_ENTRIES))
    setUnreadCount(prev => prev + 1)

    // Only the transient toast auto-dismisses; the entry stays in the history list.
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)

    if (settings.desktopNotificationsEnabled) {
      showNotification(notification.title, { body: notification.body })
    }
  }, [settings])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const removeHistoryEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setUnreadCount(0)
  }, [])

  const markHistoryRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return {
    notifications,
    history,
    unreadCount,
    addNotification,
    dismissNotification,
    removeHistoryEntry,
    clearHistory,
    markHistoryRead,
  }
}
