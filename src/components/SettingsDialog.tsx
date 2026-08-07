import { useState } from 'react'
import { useSettings } from '../lib/useSettings'
import { type Theme, type ColorScheme } from '../lib/settings'
import { Globe, Monitor, Zap, Leaf, Sun, Moon, SunMoon, X, Plus, Trash2 } from 'lucide-react'
import styles from './SettingsDialog.module.css'

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: 'default',    label: 'Default',    icon: <Globe size={16} /> },
  { id: 'retro',      label: 'Retro',      icon: <Monitor size={16} /> },
  { id: 'futuristic', label: 'Futuristic', icon: <Zap size={16} /> },
  { id: 'nature',     label: 'Nature',     icon: <Leaf size={16} /> },
]

const COLOR_SCHEMES: { id: ColorScheme; label: string; icon: React.ReactNode }[] = [
  { id: 'system', label: 'System', icon: <SunMoon size={14} /> },
  { id: 'light',  label: 'Light',  icon: <Sun size={14} /> },
  { id: 'dark',   label: 'Dark',   icon: <Moon size={14} /> },
]

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { settings, updateSettings } = useSettings()
  const [calendarUrls, setCalendarUrls] = useState(settings.calendarUrls.length > 0 ? settings.calendarUrls : [''])
  const [workMin, setWorkMin] = useState(settings.pomodoroWorkMinutes)
  const [breakMin, setBreakMin] = useState(settings.pomodoroBreakMinutes)

  const updateCalendarUrl = (index: number, value: string) => {
    setCalendarUrls((prev) => prev.map((calendarUrl, currentIndex) => currentIndex === index ? value : calendarUrl))
  }

  const addCalendarUrl = () => {
    setCalendarUrls((prev) => [...prev, ''])
  }

  const removeCalendarUrl = (index: number) => {
    setCalendarUrls((prev) => {
      const next = prev.filter((_calendarUrl, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : ['']
    })
  }

  const save = () => {
    updateSettings({
      calendarUrls,
      pomodoroWorkMinutes: workMin,
      pomodoroBreakMinutes: breakMin,
    })
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Settings">
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close settings"><X size={16} /></button>
        </div>

        <div className={styles.body}>
          {/* Theme */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Theme</h3>
            <div className={styles.themeGrid}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={[styles.themeSwatch, settings.theme === t.id ? styles.themeActive : ''].join(' ')}
                  onClick={() => updateSettings({ theme: t.id })}
                  aria-pressed={settings.theme === t.id}
                >
                  <span className={styles.themeEmoji}>{t.icon}</span>
                  <span className={styles.themeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Appearance */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Appearance</h3>
            <div className={styles.segmented}>
              {COLOR_SCHEMES.map((s) => (
                <button
                  key={s.id}
                  className={[styles.segment, settings.colorScheme === s.id ? styles.segmentActive : ''].join(' ')}
                  onClick={() => updateSettings({ colorScheme: s.id })}
                  aria-pressed={settings.colorScheme === s.id}
                >
                  {s.icon}{s.label}
                </button>
              ))}
            </div>
          </section>

          {/* Calendar */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Calendar Feeds</h3>
              <button className={styles.addCalendarBtn} onClick={addCalendarUrl} type="button">
                <Plus size={14} />
                Add link
              </button>
            </div>
            <p className={styles.hint}>
              Paste one or more ICS or CSV calendar URLs. Google share links, Outlook published
              calendar links, and webcal:// feeds are supported too.
            </p>
            <div className={styles.calendarList}>
              {calendarUrls.map((calendarUrl, index) => (
                <div className={styles.calendarRow} key={index}>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder={index === 0 ? 'https://calendar.example.com/feed.ics' : 'https://outlook.office.com/calendar/.../calendar.ics'}
                    value={calendarUrl}
                    onChange={(e) => updateCalendarUrl(index, e.target.value)}
                  />
                  <button
                    aria-label={`Remove calendar link ${index + 1}`}
                    className={styles.removeCalendarBtn}
                    onClick={() => removeCalendarUrl(index)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Pomodoro */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Pomodoro Intervals</h3>
            <div className={styles.intervalRow}>
              <label className={styles.intervalLabel}>
                Work (min)
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={120}
                  value={workMin}
                  onChange={(e) => setWorkMin(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </label>
              <label className={styles.intervalLabel}>
                Break (min)
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={60}
                  value={breakMin}
                  onChange={(e) => setBreakMin(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </label>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
