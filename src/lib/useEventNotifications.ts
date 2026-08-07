import { useState } from 'react'
import { showNotification } from './notifications'

export interface EventNotification {
  id: string
  type: 'event' | 'weather' | 'timer'
  title: string
  body?: string
  timestamp: number
}

export function useEventNotifications() {
  const [notifications, setNotifications] = useState<EventNotification[]>([])

  const addNotification = (notification: Omit<EventNotification, 'id' | 'timestamp'>) => {
    const id = `${notification.type}-${Date.now()}`
    const newNotification: EventNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
    }
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 4)])
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)

    // Show desktop notification
    showNotification(notification.title, { body: notification.body })
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return { notifications, addNotification, dismissNotification }
}
