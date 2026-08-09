import { X } from 'lucide-react'
import styles from './SettingsDialog.module.css'

interface InfoDialogProps {
  readonly onClose: () => void
}

export function InfoDialog({ onClose }: InfoDialogProps) {
  return (
    <div className={styles.backdrop}>
      <dialog className={styles.dialog} aria-label="About Dayboard" open>
        <div className={styles.header}>
          <h2 className={styles.title}>About Dayboard</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Close about dialog"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>How it works</h3>
            <ul className={styles.infoList}>
              <li>Use the settings button to control widget visibility, layout, themes, and preferences.</li>
              <li>Click the fullscreen button on any widget to focus on just that panel.</li>
              <li>Calendar widgets can use iCal feeds and will trigger upcoming event notifications.</li>
              <li>Focus mode hides distracting widgets so the dashboard stays minimal.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Need help?</h3>
            <p className={styles.hint}>
              If something looks wrong or stops working, report it here:
            </p>
            <p className={styles.infoLinkRow}>
              <a
                className={styles.infoLink}
                href="https://github.com/vargamateistvan/dayboard/issues"
                target="_blank"
                rel="noreferrer"
              >
                github.com/vargamateistvan/dayboard/issues
              </a>
            </p>
          </section>
        </div>
      </dialog>
    </div>
  )
}
