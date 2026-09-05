export type NotificationPermissionStatus = NotificationPermission | 'unsupported'

export function getNotificationPermission(): NotificationPermissionStatus {
  if (!('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const currentPermission = getNotificationPermission()
  if (currentPermission === 'unsupported' || currentPermission !== 'default') {
    return currentPermission
  }

  return Notification.requestPermission()
}

export function showNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/dayboard/favicon.svg',
      ...options,
    })
  }
}
