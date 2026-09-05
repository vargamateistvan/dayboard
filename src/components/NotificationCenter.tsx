import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarClock, CloudSun, Timer, Trash2, X } from 'lucide-react'
import type { EventNotification, NotificationType } from '../lib/useEventNotifications'
import styles from './NotificationCenter.module.css'

interface Props {
  readonly history: EventNotification[]
  readonly unreadCount: number
  readonly onMarkAllRead: () => void
  readonly onDismiss: (id: string) => void
  readonly onClearAll: () => void
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  event: <CalendarClock size={14} />,
  weather: <CloudSun size={14} />,
  timer: <Timer size={14} />,
}

function formatRelativeTime(timestamp: number, now: number): string {
  const elapsedSeconds = Math.round((timestamp - now) / 1000)
  const absoluteSeconds = Math.abs(elapsedSeconds)

  if (absoluteSeconds < 60) {
    return 'Just now'
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absoluteSeconds < 3600) {
    return formatter.format(Math.round(elapsedSeconds / 60), 'minute')
  }

  if (absoluteSeconds < 86_400) {
    return formatter.format(Math.round(elapsedSeconds / 3600), 'hour')
  }

  return formatter.format(Math.round(elapsedSeconds / 86_400), 'day')
}

export function NotificationCenter({
  history,
  unreadCount,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}: Props) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    setNow(Date.now())
    onMarkAllRead()

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000)

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onMarkAllRead])

  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div className={styles.wrap} ref={containerRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadLabel}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {history.length > 0 && (
              <button
                className={styles.clearButton}
                onClick={onClearAll}
                type="button"
              >
                <Trash2 size={13} />
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className={styles.empty}>You&apos;re all caught up.</p>
          ) : (
            <ul className={styles.list}>
              {history.map((notification) => (
                <li key={notification.id} className={styles.item}>
                  <span
                    className={[styles.itemIcon, styles[notification.type]].join(' ')}
                    aria-hidden="true"
                  >
                    {NOTIFICATION_ICONS[notification.type]}
                  </span>
                  <div className={styles.itemContent}>
                    <span className={styles.itemTitle}>{notification.title}</span>
                    {notification.body && (
                      <span className={styles.itemBody}>{notification.body}</span>
                    )}
                    <span className={styles.itemTime}>
                      {formatRelativeTime(notification.timestamp, now)}
                    </span>
                  </div>
                  <button
                    className={styles.itemDismiss}
                    onClick={() => onDismiss(notification.id)}
                    aria-label={`Dismiss ${notification.title}`}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
