import { useState, useEffect } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import styles from './TaskWidget.module.css'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: number
  dueDate: string
}

const STORAGE_KEY = 'dayboard_tasks'
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function formatTaskDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const maybeTask = raw as Partial<Task>
  const id = typeof maybeTask.id === 'string' ? maybeTask.id : ''
  const text = typeof maybeTask.text === 'string' ? maybeTask.text.trim() : ''

  if (!id || !text) {
    return null
  }

  const dueDate = typeof maybeTask.dueDate === 'string' && DATE_INPUT_PATTERN.test(maybeTask.dueDate)
    ? maybeTask.dueDate
    : ''

  return {
    id,
    text,
    completed: Boolean(maybeTask.completed),
    createdAt: typeof maybeTask.createdAt === 'number' ? maybeTask.createdAt : Date.now(),
    dueDate,
  }
}

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
        const parsed = JSON.parse(saved) as unknown
        if (!Array.isArray(parsed)) {
          return []
        }
        return parsed
          .map(normalizeTask)
          .filter((task): task is Task => task !== null)
      } catch {
        console.error('Failed to load tasks from localStorage')
        return []
      }
    }
    return []
  })
  const [input, setInput] = useState('')
  const [inputDate, setInputDate] = useState('')
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
      dueDate: inputDate,
    }
    setTasks([newTask, ...tasks])
    setInput('')
    setInputDate('')
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
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })

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
        <input
          type="date"
          value={inputDate}
          onChange={(e) => setInputDate(e.target.value)}
          className={styles.dateInput}
          aria-label="Task date"
        />
        <button type="submit" className={styles.addBtn} aria-label="Add task">
          <Plus size={18} />
        </button>
      </form>

      <div className={styles.list}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>No tasks yet</p>
        ) : (
          sortedTasks.map(task => (
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
                  <span className={styles.taskContent}>
                    <span className={styles.taskText}>{task.text}</span>
                    {task.dueDate ? (
                      <time className={styles.taskDate} dateTime={task.dueDate}>
                        {formatTaskDate(task.dueDate)}
                      </time>
                    ) : null}
                  </span>
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
