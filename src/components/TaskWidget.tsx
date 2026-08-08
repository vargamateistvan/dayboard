import { useState, useEffect } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import styles from './TaskWidget.module.css'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

const STORAGE_KEY = 'dayboard_tasks'

interface TaskWidgetProps {
  readonly isFullscreen?: boolean
}

export function TaskWidget({ isFullscreen = false }: TaskWidgetProps) {
  // Initialize from localStorage to avoid hydration mismatch
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        console.error('Failed to load tasks from localStorage')
        return []
      }
    }
    return []
  })
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  // Mark component as mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Save tasks to localStorage whenever they change (only after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    }
  }, [tasks, mounted])

  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newTask: Task = {
      id: Date.now().toString(),
      text: input.trim(),
      completed: false,
      createdAt: Date.now(),
    }
    setTasks([newTask, ...tasks])
    setInput('')
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingText(task.text)
  }

  const cancelEditingTask = () => {
    setEditingTaskId(null)
    setEditingText('')
  }

  const saveEditingTask = (id: string) => {
    const nextText = editingText.trim()

    if (!nextText) {
      cancelEditingTask()
      return
    }

    setTasks(tasks.map(task => (task.id === id ? { ...task, text: nextText } : task)))
    setEditingTaskId(null)
    setEditingText('')
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length

  return (
    <div className={[styles.widget, isFullscreen ? styles.fullscreen : ''].join(' ')}>
      <div className={styles.header}>
        <h2>Tasks</h2>
        {totalCount > 0 && (
          <span className={styles.counter}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      <form onSubmit={addTask} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          className={styles.input}
          maxLength={100}
        />
        <button type="submit" className={styles.addBtn} aria-label="Add task">
          <Plus size={18} />
        </button>
      </form>

      <div className={styles.list}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>No tasks yet</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <button
                type="button"
                className={`${styles.checkBtn} ${task.completed ? styles.checked : ''}`}
                onClick={() => toggleTask(task.id)}
                aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
              >
                {task.completed && <Check size={16} />}
              </button>
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={() => saveEditingTask(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveEditingTask(task.id)
                    } else if (e.key === 'Escape') {
                      cancelEditingTask()
                    }
                  }}
                  className={styles.taskEditInput}
                  maxLength={100}
                  autoFocus
                  aria-label={`Edit "${task.text}"`}
                />
              ) : (
                <button
                  type="button"
                  className={`${styles.taskTextButton} ${task.completed ? styles.completed : ''}`}
                  onClick={() => startEditingTask(task)}
                  aria-label={`Edit "${task.text}"`}
                >
                  <span className={styles.taskText}>{task.text}</span>
                </button>
              )}
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteTask(task.id)}
                aria-label={`Delete "${task.text}"`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
