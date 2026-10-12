import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { STORAGE_ERROR_EVENT } from '../lib/storage'
import styles from './StorageErrorNotice.module.css'

// Tells the user when a change could not be persisted (storage full or blocked).
export function StorageErrorNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleError = () => setVisible(true)
    window.addEventListener(STORAGE_ERROR_EVENT, handleError)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, handleError)
  }, [])

  if (!visible) return null

  return (
    <div className={styles.notice} role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span className={styles.text}>
        Couldn&apos;t save your latest changes. Browser storage is full or blocked, so they will be
        lost when this page closes.
      </span>
      <button
        className={styles.dismiss}
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss storage warning"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
