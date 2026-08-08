import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
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

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
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

      <div className={styles.notesGrid}>
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
