import { useState, useEffect } from 'react'
import { useSettings } from '../lib/useSettings'
import { useWidgetVisibility } from '../lib/useWidgetVisibility'
import { FONT_PRESET_OPTIONS, type Theme, type ColorScheme, type CustomColors } from '../lib/settings'
import { getThemePalette } from '../lib/colorPalette'
import { Globe, Monitor, Zap, Leaf, Waves, Palette, Type, Sun, Moon, SunMoon, X, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import styles from './SettingsDialog.module.css'

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: 'default',    label: 'Default',    icon: <Globe size={16} /> },
  { id: 'retro',      label: 'Retro',      icon: <Monitor size={16} /> },
  { id: 'futuristic', label: 'Futuristic', icon: <Zap size={16} /> },
  { id: 'nature',     label: 'Nature',     icon: <Leaf size={16} /> },
  { id: 'ocean',      label: 'Ocean',      icon: <Waves size={16} /> },
  { id: 'sunset',     label: 'Sunset',     icon: <Palette size={16} /> },
  { id: 'custom',     label: 'Custom',     icon: <Palette size={16} /> },
]

const COLOR_SCHEMES: { id: ColorScheme; label: string; icon: React.ReactNode }[] = [
  { id: 'system', label: 'System', icon: <SunMoon size={14} /> },
  { id: 'light',  label: 'Light',  icon: <Sun size={14} /> },
  { id: 'dark',   label: 'Dark',   icon: <Moon size={14} /> },
]

const WIDGETS: { id: 'clock' | 'weather' | 'calendar' | 'timer' | 'tasks'; label: string }[] = [
  { id: 'clock', label: 'Clock' },
  { id: 'weather', label: 'Weather' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timer', label: 'Timer' },
  { id: 'tasks', label: 'Tasks' },
]

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { settings, updateSettings } = useSettings()
  const { visibility, toggleWidget } = useWidgetVisibility()
  const [calendarUrls, setCalendarUrls] = useState(settings.calendarUrls.length > 0 ? settings.calendarUrls : [''])
  const [workMin, setWorkMin] = useState(settings.pomodoroWorkMinutes)
  const [breakMin, setBreakMin] = useState(settings.pomodoroBreakMinutes)
  const [customColors, setCustomColors] = useState<CustomColors>(
    settings.customColors || { primary: '#4f46e5', primaryHover: '#4338ca', background: '#0f172a', fontColor: '#f5f5f5', secondaryFontColor: '#999999' }
  )
  const [themePalette, setThemePalette] = useState<string[]>([])

  // Generate color palette when theme changes
  useEffect(() => {
    const palette = getThemePalette()
    setThemePalette(palette)
  }, [settings.theme])

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
      ...(settings.theme === 'custom' && { customColors }),
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

          {/* Fonts */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Fonts</h3>
            <div className={styles.fontGrid}>
              {FONT_PRESET_OPTIONS.map((fontOption) => (
                <button
                  key={fontOption.id}
                  className={[styles.fontSwatch, settings.fontPreset === fontOption.id ? styles.fontActive : ''].join(' ')}
                  onClick={() => updateSettings({ fontPreset: fontOption.id })}
                  aria-pressed={settings.fontPreset === fontOption.id}
                >
                  <span className={styles.fontIcon}>
                    <Type size={14} />
                  </span>
                  <span className={styles.fontLabel} style={{ fontFamily: fontOption.fontFamily }}>{fontOption.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom Colors (shown when custom theme is selected) */}
          {settings.theme === 'custom' && (
           <section className={styles.section}>
             <h3 className={styles.sectionTitle}>Custom Colors</h3>
             <p className={styles.hint}>Colors are generated from the current theme. Click a swatch to apply it, or use the color picker for custom colors.</p>
             <div className={styles.colorPickerSection}>
               {/* Primary Color */}
               <div className={styles.colorOptionGroup}>
                 <label className={styles.colorOptionLabel}>Primary Color</label>
                 <div className={styles.colorSwatchGrid}>
                   {themePalette.map((color) => (
                     <button
                       key={color}
                       className={styles.colorSwatch}
                       style={{
                         backgroundColor: color,
                         borderColor: customColors.primary === color ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                         borderWidth: customColors.primary === color ? '3px' : '2px',
                       }}
                       onClick={() => setCustomColors({ ...customColors, primary: color })}
                       title={color}
                     />
                   ))}
                 </div>
                 <div className={styles.colorInputWrapper}>
                   <input
                     type="color"
                     className={styles.colorInput}
                     value={customColors.primary}
                     onChange={(e) => setCustomColors({ ...customColors, primary: e.target.value })}
                   />
                   <span className={styles.colorValue}>{customColors.primary}</span>
                 </div>
               </div>

               {/* Hover Color */}
               <div className={styles.colorOptionGroup}>
                 <label className={styles.colorOptionLabel}>Hover Color</label>
                 <div className={styles.colorSwatchGrid}>
                   {themePalette.map((color) => (
                     <button
                       key={color}
                       className={styles.colorSwatch}
                       style={{
                         backgroundColor: color,
                         borderColor: customColors.primaryHover === color ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                         borderWidth: customColors.primaryHover === color ? '3px' : '2px',
                       }}
                       onClick={() => setCustomColors({ ...customColors, primaryHover: color })}
                       title={color}
                     />
                   ))}
                 </div>
                 <div className={styles.colorInputWrapper}>
                   <input
                     type="color"
                     className={styles.colorInput}
                     value={customColors.primaryHover}
                     onChange={(e) => setCustomColors({ ...customColors, primaryHover: e.target.value })}
                   />
                   <span className={styles.colorValue}>{customColors.primaryHover}</span>
                 </div>
               </div>

               {/* Background Color */}
               <div className={styles.colorOptionGroup}>
                 <label className={styles.colorOptionLabel}>Background Color</label>
                 <div className={styles.colorSwatchGrid}>
                   {themePalette.map((color) => (
                     <button
                       key={color}
                       className={styles.colorSwatch}
                       style={{
                         backgroundColor: color,
                         borderColor: customColors.background === color ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                         borderWidth: customColors.background === color ? '3px' : '2px',
                       }}
                       onClick={() => setCustomColors({ ...customColors, background: color })}
                       title={color}
                     />
                   ))}
                 </div>
                 <div className={styles.colorInputWrapper}>
                   <input
                     type="color"
                     className={styles.colorInput}
                     value={customColors.background}
                     onChange={(e) => setCustomColors({ ...customColors, background: e.target.value })}
                   />
                   <span className={styles.colorValue}>{customColors.background}</span>
                 </div>
               </div>

               {/* Font Color */}
               <div className={styles.colorOptionGroup}>
                 <label className={styles.colorOptionLabel}>Font Color</label>
                 <div className={styles.colorSwatchGrid}>
                   {themePalette.map((color) => (
                     <button
                       key={color}
                       className={styles.colorSwatch}
                       style={{
                         backgroundColor: color,
                         borderColor: customColors.fontColor === color ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                         borderWidth: customColors.fontColor === color ? '3px' : '2px',
                       }}
                       onClick={() => setCustomColors({ ...customColors, fontColor: color })}
                       title={color}
                     />
                   ))}
                 </div>
                 <div className={styles.colorInputWrapper}>
                   <input
                     type="color"
                     className={styles.colorInput}
                     value={customColors.fontColor}
                     onChange={(e) => setCustomColors({ ...customColors, fontColor: e.target.value })}
                   />
                   <span className={styles.colorValue}>{customColors.fontColor}</span>
                 </div>
               </div>

               {/* Secondary Font Color */}
               <div className={styles.colorOptionGroup}>
                 <label className={styles.colorOptionLabel}>Secondary Font Color</label>
                 <div className={styles.colorSwatchGrid}>
                   {themePalette.map((color) => (
                     <button
                       key={color}
                       className={styles.colorSwatch}
                       style={{
                         backgroundColor: color,
                         borderColor: customColors.secondaryFontColor === color ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                         borderWidth: customColors.secondaryFontColor === color ? '3px' : '2px',
                       }}
                       onClick={() => setCustomColors({ ...customColors, secondaryFontColor: color })}
                       title={color}
                     />
                   ))}
                 </div>
                 <div className={styles.colorInputWrapper}>
                   <input
                     type="color"
                     className={styles.colorInput}
                     value={customColors.secondaryFontColor}
                     onChange={(e) => setCustomColors({ ...customColors, secondaryFontColor: e.target.value })}
                   />
                   <span className={styles.colorValue}>{customColors.secondaryFontColor}</span>
                 </div>
               </div>
             </div>
           </section>
          )}

          {/* Widgets */}
          <section className={styles.section}>
           <h3 className={styles.sectionTitle}>Widgets</h3>
           <div className={styles.widgetGrid}>
             {WIDGETS.map((widget) => (
               <button
                 key={widget.id}
                 className={[styles.widgetToggle, visibility[widget.id] ? styles.widgetVisible : ''].join(' ')}
                 onClick={() => toggleWidget(widget.id)}
                 title={`Toggle ${widget.label} widget`}
               >
                 {visibility[widget.id] ? <Eye size={14} /> : <EyeOff size={14} />}
                 <span>{widget.label}</span>
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
