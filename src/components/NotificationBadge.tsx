import { X } from 'lucide-react'
import { EventNotification } from '../lib/useEventNotifications'
import styles from './NotificationBadge.module.css'

interface Props {
  notifications: EventNotification[]
  onDismiss: (id: string) => void
}

export function NotificationBadge({ notifications, onDismiss }: Props) {
  if (notifications.length === 0) return null

  return (
    <div className={styles.container}>
      {notifications.map(notification => (
        <div key={notification.id} className={`${styles.badge} ${styles[notification.type]}`}>
          <div className={styles.content}>
            <div className={styles.title}>{notification.title}</div>
            {notification.body && <div className={styles.body}>{notification.body}</div>}
          </div>
          <button
            className={styles.close}
            onClick={() => onDismiss(notification.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
