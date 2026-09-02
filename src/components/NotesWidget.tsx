import { useState, useEffect, useMemo, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { isMotionEnabled, loadAnimeJs, MOTION_DURATIONS, MOTION_STAGGERS } from '../lib/anime'
import styles from './NotesWidget.module.css'

interface Note {
  id: string
  text: string
  color: 'yellow' | 'pink' | 'blue' | 'green'
  createdAt: number
}

const STORAGE_KEY = 'dayboard_notes'

const COLORS = ['yellow', 'pink', 'blue', 'green'] as const

interface NotesWidgetProps {
  readonly isFullscreen?: boolean
}

export function NotesWidget({ isFullscreen = false }: NotesWidgetProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedColor, setSelectedColor] = useState<Note['color']>('yellow')
  const widgetRootRef = useRef<HTMLDivElement | null>(null)
  const notesGridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setNotes(JSON.parse(saved))
      } catch {
        console.error('Failed to load notes')
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      text: '',
      color: selectedColor,
      createdAt: Date.now(),
    }
    setNotes([newNote, ...notes])
  }

  const updateNote = (id: string, text: string) => {
    setNotes(notes.map(n => (n.id === id ? { ...n, text } : n)))
  }

  const changeColor = (id: string, color: Note['color']) => {
    setNotes(notes.map(n => (n.id === id ? { ...n, color } : n)))
  }

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id))
  }

  const notesAnimationSignature = useMemo(
    () =>
      notes
        .map((note) => `${note.id}:${note.color}:${note.text.length}`)
        .join('|'),
    [notes],
  )

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const notesGridNode = notesGridRef.current
    if (!notesGridNode) {
      return
    }

    const noteNodes = Array.from(notesGridNode.querySelectorAll<HTMLElement>(`.${styles.note}`))
    if (!noteNodes.length) {
      return
    }

    let cancelled = false
    let activeAnimations: Array<{ cancel?: () => void }> = []

    void loadAnimeJs().then((anime) => {
      if (cancelled || !anime?.animate) {
        return
      }

      if (anime.stagger) {
        activeAnimations = [
          anime.animate(noteNodes, {
            opacity: [0, 1],
            translateY: [10, 0],
            duration: MOTION_DURATIONS.medium,
            delay: anime.stagger(MOTION_STAGGERS.tight),
          }),
        ]
        return
      }

      activeAnimations = noteNodes.map((noteNode, index) =>
        anime.animate(noteNode, {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: MOTION_DURATIONS.medium,
          delay: index * MOTION_STAGGERS.tight,
        }),
      )
    })

    return () => {
      cancelled = true
      activeAnimations.forEach((animation) => animation.cancel?.())
    }
  }, [notesAnimationSignature])

  useEffect(() => {
    if (!isMotionEnabled()) {
      return
    }

    const rootNode = widgetRootRef.current
    if (!rootNode) {
      return
    }

    const isInteractiveButton = (button: HTMLButtonElement) =>
      button.classList.contains(styles.addBtn) ||
      button.classList.contains(styles.colorBtn) ||
      button.classList.contains(styles.colorOption) ||
      button.classList.contains(styles.deleteBtn)

    const resolveButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null
      }
      const button = target.closest('button')
      return button instanceof HTMLButtonElement ? button : null
    }

    let cancelled = false

    const animateButton = (
      button: HTMLButtonElement,
      options: { scale: number; translateY: number; duration: number },
    ) => {
      void loadAnimeJs().then((anime) => {
        if (cancelled || !anime?.animate) {
          return
        }
        anime.animate(button, options)
      })
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 1.04,
        translateY: -1,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button)) {
        return
      }
      animateButton(button, {
        scale: 1,
        translateY: 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: 0.97,
        translateY: 0,
        duration: Math.max(80, MOTION_DURATIONS.quick - 50),
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const button = resolveButton(event.target)
      if (!button || !isInteractiveButton(button) || button.disabled) {
        return
      }
      animateButton(button, {
        scale: button.matches(':hover') ? 1.04 : 1,
        translateY: button.matches(':hover') ? -1 : 0,
        duration: MOTION_DURATIONS.quick,
      })
    }

    rootNode.addEventListener('pointerenter', handlePointerEnter, true)
    rootNode.addEventListener('pointerleave', handlePointerLeave, true)
    rootNode.addEventListener('pointerdown', handlePointerDown, true)
    rootNode.addEventListener('pointerup', handlePointerUp, true)
    rootNode.addEventListener('pointercancel', handlePointerUp, true)

    return () => {
      cancelled = true
      rootNode.removeEventListener('pointerenter', handlePointerEnter, true)
      rootNode.removeEventListener('pointerleave', handlePointerLeave, true)
      rootNode.removeEventListener('pointerdown', handlePointerDown, true)
      rootNode.removeEventListener('pointerup', handlePointerUp, true)
      rootNode.removeEventListener('pointercancel', handlePointerUp, true)
    }
  }, [])

  return (
    <div ref={widgetRootRef} className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <h2>Notes</h2>
        <button onClick={addNote} className={styles.addBtn} title="Add note">
          +
        </button>
      </div>

      <div className={styles.colorPicker}>
        {COLORS.map(color => (
          <button
            key={color}
            className={`${styles.colorBtn} ${styles[color]} ${selectedColor === color ? styles.active : ''}`}
            onClick={() => setSelectedColor(color)}
            title={`Select ${color} color`}
          />
        ))}
      </div>

      <div ref={notesGridRef} className={styles.notesGrid}>
        {notes.length === 0 ? (
          <p className={styles.empty}>Click + to add your first note</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className={`${styles.note} ${styles[note.color]}`}>
              <textarea
                value={note.text}
                onChange={e => updateNote(note.id, e.target.value)}
                placeholder="Type your note..."
                className={styles.textarea}
              />
              <div className={styles.noteFooter}>
                <div className={styles.noteColors}>
                  {COLORS.map(color => (
                    <button
                      key={color}
                      className={`${styles.colorOption} ${styles[color]} ${note.color === color ? styles.selected : ''}`}
                      onClick={() => changeColor(note.id, color)}
                      title={`Change to ${color}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className={styles.deleteBtn}
                  title="Delete note"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
