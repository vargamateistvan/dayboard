export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      return permission === 'granted'
    })
  }

  return false
}

export function showNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/dayboard/favicon.svg',
      ...options,
    })
  }
}

export function showPomodoroNotification(phase: 'work' | 'break', autoCycle: boolean) {
  if (phase === 'work') {
    showNotification('Work Session Complete!', {
      body: autoCycle ? 'Break session starting...' : 'Time for a break!',
      tag: 'pomodoro',
    })
  } else {
    showNotification('Break Over!', {
      body: autoCycle ? 'Work session starting...' : 'Ready to work?',
      tag: 'pomodoro',
    })
  }
}
