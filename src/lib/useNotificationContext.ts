import { createContext, useContext } from 'react'
import { EventNotification } from './useEventNotifications'

interface NotificationContextType {
  notifications: EventNotification[]
  addNotification: (notification: Omit<EventNotification, 'id' | 'timestamp'>) => void
  dismissNotification: (id: string) => void
}

export const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}
